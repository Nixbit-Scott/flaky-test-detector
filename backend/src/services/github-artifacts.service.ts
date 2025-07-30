import { GitHubAppService } from './github-app.service';
import { TestResultService, TestResultData } from './test-result.service';
import { logger } from '../utils/logger';
import { prisma } from './database.service';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as AdmZip from 'adm-zip';
import * as xml2js from 'xml2js';

export interface TestArtifact {
  id: number;
  name: string;
  size_in_bytes: number;
  archive_download_url: string;
  created_at: string;
}

export interface ParsedTestResults {
  format: 'junit' | 'json' | 'tap' | 'unknown';
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  tests: TestResultData[];
  duration?: number;
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
}

export class GitHubArtifactsService {
  private githubApp: GitHubAppService;
  private testResultService: TestResultService;

  constructor() {
    this.githubApp = GitHubAppService.getInstance();
    this.testResultService = new TestResultService();
  }

  /**
   * Download and process test artifacts from a workflow run
   */
  public async processWorkflowArtifacts(
    projectId: string,
    owner: string,
    repo: string,
    runId: number,
    options: {
      artifactNames?: string[];
      processAllArtifacts?: boolean;
      skipCoverage?: boolean;
    } = {}
  ): Promise<{
    processed: boolean;
    testResults: ParsedTestResults[];
    errors: string[];
  }> {
    const errors: string[] = [];
    const testResults: ParsedTestResults[] = [];

    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project?.githubInstallationId) {
        errors.push(`No GitHub installation found for project ${projectId}`);
        return { processed: false, testResults, errors };
      }

      const installationId = parseInt(project.githubInstallationId);

      // Get artifacts for the workflow run
      const artifacts = await this.githubApp.getWorkflowArtifacts(installationId, owner, repo, runId);

      if (artifacts.length === 0) {
        logger.info(`No artifacts found for workflow run ${runId}`);
        return { processed: true, testResults, errors };
      }

      // Filter artifacts if specific names are provided
      const targetArtifacts = options.artifactNames 
        ? artifacts.filter(a => options.artifactNames!.some(name => a.name.includes(name)))
        : artifacts;

      if (!options.processAllArtifacts) {
        // Focus on common test result artifact names
        const testArtifactPatterns = [
          /test.*results?/i,
          /junit/i,
          /coverage/i,
          /reports?/i,
          /artifacts?/i
        ];

        const filteredArtifacts = targetArtifacts.filter(a => 
          testArtifactPatterns.some(pattern => pattern.test(a.name))
        );

        if (filteredArtifacts.length > 0) {
          targetArtifacts.splice(0, targetArtifacts.length, ...filteredArtifacts);
        }
      }

      logger.info(`Processing ${targetArtifacts.length} artifacts for run ${runId}`);

      // Process each artifact
      for (const artifact of targetArtifacts) {
        try {
          const results = await this.downloadAndParseArtifact(
            installationId,
            artifact,
            options.skipCoverage
          );

          if (results) {
            testResults.push(results);
            logger.info(`Parsed ${results.totalTests} tests from artifact ${artifact.name}`);
          }
        } catch (error) {
          const errorMsg = `Failed to process artifact ${artifact.name}: ${error}`;
          logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // Store test results in database if any were found
      if (testResults.length > 0) {
        await this.storeArtifactTestResults(projectId, runId, testResults);
      }

      return {
        processed: true,
        testResults,
        errors
      };

    } catch (error) {
      const errorMsg = `Failed to process workflow artifacts: ${error}`;
      logger.error(errorMsg);
      errors.push(errorMsg);
      return { processed: false, testResults, errors };
    }
  }

  /**
   * Download and parse a single artifact
   */
  private async downloadAndParseArtifact(
    installationId: number,
    artifact: TestArtifact,
    skipCoverage: boolean = false
  ): Promise<ParsedTestResults | null> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'github-artifact-'));
    
    try {
      // Download the artifact
      const installationToken = await this.githubApp.getInstallationToken(installationId);
      
      const response = await axios({
        method: 'GET',
        url: artifact.archive_download_url,
        headers: {
          'Authorization': `token ${installationToken.token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        responseType: 'arraybuffer'
      });

      // Save and extract the zip file
      const zipPath = path.join(tempDir, `${artifact.name}.zip`);
      fs.writeFileSync(zipPath, response.data);

      const zip = new AdmZip(zipPath);
      const extractPath = path.join(tempDir, 'extracted');
      zip.extractAllTo(extractPath, true);

      // Find and parse test result files
      const testFiles = this.findTestResultFiles(extractPath);
      
      if (testFiles.length === 0) {
        logger.warn(`No test result files found in artifact ${artifact.name}`);
        return null;
      }

      // Parse all test files and combine results
      const allTests: TestResultData[] = [];
      let totalDuration = 0;
      let coverage: ParsedTestResults['coverage'] | undefined;

      for (const testFile of testFiles) {
        const parsed = await this.parseTestResultFile(testFile);
        if (parsed) {
          allTests.push(...parsed.tests);
          totalDuration += parsed.duration || 0;
          
          if (!skipCoverage && parsed.coverage && !coverage) {
            coverage = parsed.coverage;
          }
        }
      }

      if (allTests.length === 0) {
        return null;
      }

      // Calculate summary statistics
      const passedTests = allTests.filter(t => t.status === 'passed').length;
      const failedTests = allTests.filter(t => t.status === 'failed').length;
      const skippedTests = allTests.filter(t => t.status === 'skipped').length;

      return {
        format: this.detectResultFormat(testFiles[0]),
        totalTests: allTests.length,
        passedTests,
        failedTests,
        skippedTests,
        tests: allTests,
        duration: totalDuration > 0 ? totalDuration : undefined,
        coverage
      };

    } finally {
      // Clean up temporary files
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (error) {
        logger.warn(`Failed to clean up temp directory ${tempDir}:`, error);
      }
    }
  }

  /**
   * Find test result files in extracted artifact
   */
  private findTestResultFiles(rootPath: string): string[] {
    const testFiles: string[] = [];

    const searchPatterns = [
      /.*\.xml$/i,           // JUnit XML
      /.*test.*\.json$/i,    // JSON test results
      /.*junit.*\.xml$/i,    // JUnit specifically
      /.*results?\.xml$/i,   // General results XML
      /.*report\.xml$/i,     // Test reports
      /.*\.tap$/i,           // TAP format
    ];

    const walk = (dir: string) => {
      try {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            walk(filePath);
          } else if (searchPatterns.some(pattern => pattern.test(file))) {
            testFiles.push(filePath);
          }
        }
      } catch (error) {
        logger.warn(`Error walking directory ${dir}:`, error);
      }
    };

    walk(rootPath);
    return testFiles;
  }

  /**
   * Parse a single test result file
   */
  private async parseTestResultFile(filePath: string): Promise<ParsedTestResults | null> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const format = this.detectResultFormat(filePath);

      switch (format) {
        case 'junit':
          return await this.parseJUnitXML(content);
        case 'json':
          return this.parseJSONResults(content);
        case 'tap':
          return this.parseTAPResults(content);
        default:
          logger.warn(`Unknown test result format for file ${filePath}`);
          return null;
      }
    } catch (error) {
      logger.error(`Failed to parse test result file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse JUnit XML format
   */
  private async parseJUnitXML(xmlContent: string): Promise<ParsedTestResults | null> {
    try {
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(xmlContent);

      const tests: TestResultData[] = [];
      let totalDuration = 0;

      // Handle different JUnit XML structures
      const testsuites = result.testsuites?.testsuite || result.testsuite || [result];

      for (const testsuite of Array.isArray(testsuites) ? testsuites : [testsuites]) {
        if (!testsuite) continue;

        const suiteName = testsuite.$.name || 'unknown';
        const suiteTime = parseFloat(testsuite.$.time || '0');
        totalDuration += suiteTime * 1000; // Convert to milliseconds

        const testcases = testsuite.testcase || [];
        
        for (const testcase of Array.isArray(testcases) ? testcases : [testcases]) {
          if (!testcase || !testcase.$) continue;

          const testName = testcase.$.name;
          const className = testcase.$.classname || suiteName;
          const time = parseFloat(testcase.$.time || '0') * 1000; // Convert to ms

          let status: 'passed' | 'failed' | 'skipped' = 'passed';
          let errorMessage: string | undefined;
          let stackTrace: string | undefined;

          if (testcase.failure) {
            status = 'failed';
            const failure = Array.isArray(testcase.failure) ? testcase.failure[0] : testcase.failure;
            errorMessage = failure.$.message || 'Test failed';
            stackTrace = failure._ || failure.$?.text;
          } else if (testcase.error) {
            status = 'failed';
            const error = Array.isArray(testcase.error) ? testcase.error[0] : testcase.error;
            errorMessage = error.$.message || 'Test error';
            stackTrace = error._ || error.$?.text;
          } else if (testcase.skipped) {
            status = 'skipped';
            const skipped = Array.isArray(testcase.skipped) ? testcase.skipped[0] : testcase.skipped;
            errorMessage = skipped.$.message || 'Test skipped';
          }

          tests.push({
            testName,
            testSuite: className,
            status,
            duration: time > 0 ? Math.round(time) : undefined,
            errorMessage,
            stackTrace,
            retryAttempt: 0,
          });
        }
      }

      const passedTests = tests.filter(t => t.status === 'passed').length;
      const failedTests = tests.filter(t => t.status === 'failed').length;
      const skippedTests = tests.filter(t => t.status === 'skipped').length;

      return {
        format: 'junit',
        totalTests: tests.length,
        passedTests,
        failedTests,
        skippedTests,
        tests,
        duration: totalDuration > 0 ? Math.round(totalDuration) : undefined,
      };

    } catch (error) {
      logger.error('Failed to parse JUnit XML:', error);
      return null;
    }
  }

  /**
   * Parse JSON test results (Jest, Mocha, etc.)
   */
  private parseJSONResults(jsonContent: string): ParsedTestResults | null {
    try {
      const data = JSON.parse(jsonContent);
      const tests: TestResultData[] = [];

      // Handle Jest format
      if (data.testResults && Array.isArray(data.testResults)) {
        for (const testFile of data.testResults) {
          const suiteName = testFile.name || 'unknown';
          
          for (const assertionResult of testFile.assertionResults || []) {
            tests.push({
              testName: assertionResult.title,
              testSuite: suiteName,
              status: assertionResult.status === 'passed' ? 'passed' : 
                     assertionResult.status === 'pending' ? 'skipped' : 'failed',
              duration: assertionResult.duration,
              errorMessage: assertionResult.failureMessages?.join('\n'),
              retryAttempt: 0,
            });
          }
        }
      }

      // Handle generic format
      else if (Array.isArray(data)) {
        for (const test of data) {
          tests.push({
            testName: test.name || test.title,
            testSuite: test.suite || test.file || 'unknown',
            status: test.status === 'pass' || test.status === 'passed' ? 'passed' :
                   test.status === 'skip' || test.status === 'skipped' ? 'skipped' : 'failed',
            duration: test.duration || test.time,
            errorMessage: test.error || test.message,
            stackTrace: test.stack,
            retryAttempt: 0,
          });
        }
      }

      if (tests.length === 0) {
        return null;
      }

      const passedTests = tests.filter(t => t.status === 'passed').length;
      const failedTests = tests.filter(t => t.status === 'failed').length;
      const skippedTests = tests.filter(t => t.status === 'skipped').length;

      return {
        format: 'json',
        totalTests: tests.length,
        passedTests,
        failedTests,
        skippedTests,
        tests,
      };

    } catch (error) {
      logger.error('Failed to parse JSON test results:', error);
      return null;
    }
  }

  /**
   * Parse TAP (Test Anything Protocol) format
   */
  private parseTAPResults(tapContent: string): ParsedTestResults | null {
    try {
      const lines = tapContent.split('\n');
      const tests: TestResultData[] = [];
      let testCount = 0;

      for (const line of lines) {
        const trimmed = line.trim();
        
        // Test plan: 1..N
        if (trimmed.match(/^\d+\.\.\d+$/)) {
          const match = trimmed.match(/^\d+\.\.(\d+)$/);
          if (match) {
            testCount = parseInt(match[1]);
          }
          continue;
        }

        // Test result: ok/not ok N description
        const testMatch = trimmed.match(/^(ok|not ok)\s+(\d+)\s+(.*)$/);
        if (testMatch) {
          const [, result, num, description] = testMatch;
          const isSkipped = description.includes('# SKIP');
          
          tests.push({
            testName: description.replace(/\s*#.*$/, ''), // Remove comments
            testSuite: 'TAP',
            status: isSkipped ? 'skipped' : result === 'ok' ? 'passed' : 'failed',
            retryAttempt: 0,
          });
        }
      }

      if (tests.length === 0) {
        return null;
      }

      const passedTests = tests.filter(t => t.status === 'passed').length;
      const failedTests = tests.filter(t => t.status === 'failed').length;
      const skippedTests = tests.filter(t => t.status === 'skipped').length;

      return {
        format: 'tap',
        totalTests: tests.length,
        passedTests,
        failedTests,
        skippedTests,
        tests,
      };

    } catch (error) {
      logger.error('Failed to parse TAP results:', error);
      return null;
    }
  }

  /**
   * Detect test result format from file path
   */
  private detectResultFormat(filePath: string): 'junit' | 'json' | 'tap' | 'unknown' {
    const fileName = path.basename(filePath).toLowerCase();
    
    if (fileName.endsWith('.xml') || fileName.includes('junit')) {
      return 'junit';
    } else if (fileName.endsWith('.json')) {
      return 'json';
    } else if (fileName.endsWith('.tap')) {
      return 'tap';
    }
    
    return 'unknown';
  }

  /**
   * Store parsed test results in database
   */
  private async storeArtifactTestResults(
    projectId: string,
    runId: number,
    testResults: ParsedTestResults[]
  ): Promise<void> {
    try {
      // Create a test run entry for the artifact results
      const testRun = await prisma.testRun.create({
        data: {
          projectId,
          testSuiteName: `GitHub Actions Run ${runId}`,
          branch: 'main', // Could be extracted from workflow data
          commit: 'unknown', // Could be extracted from workflow data
          buildId: runId.toString(),
          status: 'completed',
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });

      // Store all test results
      for (const result of testResults) {
        for (const test of result.tests) {
          await prisma.testResult.create({
            data: {
              testRunId: testRun.id,
              projectId,
              testName: test.testName,
              testSuite: test.testSuite,
              status: test.status,
              duration: test.duration,
              errorMessage: test.errorMessage,
              stackTrace: test.stackTrace,
              retryAttempt: test.retryAttempt || 0,
            },
          });
        }
      }

      logger.info(`Stored ${testResults.reduce((sum, r) => sum + r.totalTests, 0)} test results from artifacts for run ${runId}`);

    } catch (error) {
      logger.error(`Failed to store artifact test results for run ${runId}:`, error);
      throw error;
    }
  }
}