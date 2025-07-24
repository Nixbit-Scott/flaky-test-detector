import * as esprima from 'esprima';
import * as crypto from 'crypto';

export interface StaticCodeFeatures {
  // Complexity Metrics
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  nestingDepth: number;
  linesOfCode: number;

  // Async Patterns
  asyncAwaitCount: number;
  promiseChainCount: number;
  timeoutCount: number;
  setIntervalCount: number;

  // External Dependencies
  httpCallCount: number;
  fileSystemCount: number;
  databaseQueryCount: number;
  externalServiceCount: number;

  // Test Structure
  setupTeardownComplexity: number;
  sharedStateUsage: number;
  testIsolationScore: number;

  // Risk Patterns
  hardcodedDelays: number;
  raceConditionPatterns: number;
  timingSensitivity: number;
  resourceLeakRisk: number;
}

export interface FlakyRiskPatterns {
  // High-risk timing patterns
  TIMING_DEPENDENCY: RegExp[];
  EXTERNAL_SERVICE: RegExp[];
  FILE_SYSTEM: RegExp[];
  ASYNC_RACE_CONDITIONS: RegExp[];
  SHARED_STATE: RegExp[];
  HARDCODED_DELAYS: RegExp[];
  DATABASE_OPERATIONS: RegExp[];
  RESOURCE_LEAKS: RegExp[];
}

export class StaticCodeAnalysisService {
  private readonly FLAKY_PATTERNS: FlakyRiskPatterns = {
    TIMING_DEPENDENCY: [
      /setTimeout\s*\(/g,
      /setInterval\s*\(/g,
      /Date\.now\s*\(/g,
      /new Date\(\)/g,
      /performance\.now\(\)/g,
      /process\.hrtime/g
    ],
    EXTERNAL_SERVICE: [
      /fetch\s*\(/g,
      /axios\./g,
      /http\./g,
      /https\./g,
      /request\s*\(/g,
      /supertest/g,
      /got\s*\(/g
    ],
    FILE_SYSTEM: [
      /fs\./g,
      /readFile/g,
      /writeFile/g,
      /createReadStream/g,
      /createWriteStream/g,
      /existsSync/g,
      /mkdirSync/g
    ],
    ASYNC_RACE_CONDITIONS: [
      /Promise\.all\s*\(/g,
      /Promise\.race\s*\(/g,
      /Promise\.allSettled/g,
      /await.*await/g
    ],
    SHARED_STATE: [
      /global\./g,
      /window\./g,
      /process\.env/g,
      /module\.exports/g,
      /require\.cache/g
    ],
    HARDCODED_DELAYS: [
      /sleep\s*\(/g,
      /delay\s*\(/g,
      /wait\s*\(/g,
      /setTimeout\s*\(\s*.*,\s*\d+/g
    ],
    DATABASE_OPERATIONS: [
      /\.query\s*\(/g,
      /\.execute\s*\(/g,
      /\.findOne/g,
      /\.save\s*\(/g,
      /\.create\s*\(/g,
      /\.update\s*\(/g,
      /\.delete\s*\(/g,
      /prisma\./g,
      /mongoose\./g
    ],
    RESOURCE_LEAKS: [
      /new.*Stream\(/g,
      /\.createConnection/g,
      /\.listen\s*\(/g,
      /\.connect\s*\(/g,
      /child_process/g
    ]
  };

  private readonly TEST_FRAMEWORK_PATTERNS = {
    JEST: [/describe\s*\(/g, /it\s*\(/g, /test\s*\(/g, /beforeEach/g, /afterEach/g],
    MOCHA: [/describe\s*\(/g, /it\s*\(/g, /before\s*\(/g, /after\s*\(/g],
    CYPRESS: [/cy\./g, /Cypress\./g],
    PLAYWRIGHT: [/page\./g, /browser\./g, /context\./g]
  };

  public async analyzeTestFile(
    filePath: string,
    fileContent: string,
    fileType: 'javascript' | 'typescript' = 'typescript'
  ): Promise<StaticCodeFeatures> {
    try {
      const ast = this.parseCode(fileContent, fileType);
      const features = this.extractFeatures(ast, fileContent);
      
      return features;
    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error);
      return this.getDefaultFeatures();
    }
  }

  private parseCode(code: string, fileType: 'javascript' | 'typescript') {
    // For simplicity, use esprima for both JS and TS (basic parsing)
    try {
      return esprima.parseScript(code, {
        loc: true,
        range: true,
        tokens: true,
        tolerant: true
      });
    } catch (error) {
      // If parsing fails, try as module
      return esprima.parseModule(code, {
        loc: true,
        range: true,
        tokens: true
      });
    }
  }

  private extractFeatures(ast: any, code: string): StaticCodeFeatures {
    const features: StaticCodeFeatures = this.getDefaultFeatures();

    // Calculate basic metrics
    features.linesOfCode = code.split('\n').length;
    features.cyclomaticComplexity = this.calculateCyclomaticComplexity(ast);
    features.cognitiveComplexity = this.calculateCognitiveComplexity(ast);
    features.nestingDepth = this.calculateNestingDepth(ast);

    // Analyze async patterns
    features.asyncAwaitCount = this.countPatterns(code, [/async\s+/g, /await\s+/g]);
    features.promiseChainCount = this.countPatterns(code, [/\.then\s*\(/g, /\.catch\s*\(/g]);
    features.timeoutCount = this.countPatterns(code, this.FLAKY_PATTERNS.TIMING_DEPENDENCY);
    features.setIntervalCount = this.countPatterns(code, [/setInterval\s*\(/g]);

    // Analyze external dependencies
    features.httpCallCount = this.countPatterns(code, this.FLAKY_PATTERNS.EXTERNAL_SERVICE);
    features.fileSystemCount = this.countPatterns(code, this.FLAKY_PATTERNS.FILE_SYSTEM);
    features.databaseQueryCount = this.countPatterns(code, this.FLAKY_PATTERNS.DATABASE_OPERATIONS);
    features.externalServiceCount = features.httpCallCount + features.databaseQueryCount;

    // Analyze test structure
    features.setupTeardownComplexity = this.analyzeSetupTeardown(code);
    features.sharedStateUsage = this.countPatterns(code, this.FLAKY_PATTERNS.SHARED_STATE);
    features.testIsolationScore = this.calculateTestIsolationScore(code);

    // Analyze risk patterns
    features.hardcodedDelays = this.countPatterns(code, this.FLAKY_PATTERNS.HARDCODED_DELAYS);
    features.raceConditionPatterns = this.countPatterns(code, this.FLAKY_PATTERNS.ASYNC_RACE_CONDITIONS);
    features.timingSensitivity = this.calculateTimingSensitivity(code);
    features.resourceLeakRisk = this.countPatterns(code, this.FLAKY_PATTERNS.RESOURCE_LEAKS) / features.linesOfCode;

    return features;
  }

  private countPatterns(code: string, patterns: RegExp[]): number {
    return patterns.reduce((count, pattern) => {
      const matches = code.match(pattern);
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  private calculateCyclomaticComplexity(ast: any): number {
    let complexity = 1; // Base complexity

    const traverse = (node: any) => {
      if (!node) return;

      // Add complexity for decision points
      if (node.type === 'IfStatement' ||
          node.type === 'SwitchCase' ||
          node.type === 'WhileStatement' ||
          node.type === 'ForStatement' ||
          node.type === 'DoWhileStatement' ||
          node.type === 'ConditionalExpression' ||
          node.type === 'LogicalExpression' && (node.operator === '&&' || node.operator === '||') ||
          node.type === 'CatchClause') {
        complexity++;
      }

      // Traverse child nodes
      Object.keys(node).forEach(key => {
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(traverse);
        } else if (child && typeof child === 'object' && child.type) {
          traverse(child);
        }
      });
    };

    traverse(ast);
    return complexity;
  }

  private calculateCognitiveComplexity(ast: any): number {
    let complexity = 0;
    let nestingLevel = 0;

    const traverse = (node: any, increaseNesting = false) => {
      if (!node) return;

      if (increaseNesting) nestingLevel++;

      // Add complexity for various constructs
      if (node.type === 'IfStatement') {
        complexity += 1 + nestingLevel;
        traverse(node.consequent, true);
        if (node.alternate) traverse(node.alternate, false);
      } else if (node.type === 'SwitchCase') {
        complexity += 1 + nestingLevel;
      } else if (node.type === 'WhileStatement' || 
                 node.type === 'ForStatement' || 
                 node.type === 'DoWhileStatement') {
        complexity += 1 + nestingLevel;
        traverse(node.body, true);
      } else if (node.type === 'CatchClause') {
        complexity += 1 + nestingLevel;
      } else {
        // Traverse child nodes
        Object.keys(node).forEach(key => {
          const child = node[key];
          if (Array.isArray(child)) {
            child.forEach(n => traverse(n, false));
          } else if (child && typeof child === 'object' && child.type) {
            traverse(child, false);
          }
        });
      }

      if (increaseNesting) nestingLevel--;
    };

    traverse(ast);
    return complexity;
  }

  private calculateNestingDepth(ast: any): number {
    let maxDepth = 0;
    let currentDepth = 0;

    const traverse = (node: any) => {
      if (!node) return;

      if (node.type === 'BlockStatement' ||
          node.type === 'IfStatement' ||
          node.type === 'WhileStatement' ||
          node.type === 'ForStatement' ||
          node.type === 'DoWhileStatement' ||
          node.type === 'SwitchStatement') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      }

      Object.keys(node).forEach(key => {
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(traverse);
        } else if (child && typeof child === 'object' && child.type) {
          traverse(child);
        }
      });

      if (node.type === 'BlockStatement' ||
          node.type === 'IfStatement' ||
          node.type === 'WhileStatement' ||
          node.type === 'ForStatement' ||
          node.type === 'DoWhileStatement' ||
          node.type === 'SwitchStatement') {
        currentDepth--;
      }
    };

    traverse(ast);
    return maxDepth;
  }

  private analyzeSetupTeardown(code: string): number {
    const setupPatterns = [
      /beforeEach\s*\(/g,
      /beforeAll\s*\(/g,
      /before\s*\(/g,
      /setup\s*\(/g
    ];

    const teardownPatterns = [
      /afterEach\s*\(/g,
      /afterAll\s*\(/g,
      /after\s*\(/g,
      /teardown\s*\(/g,
      /cleanup\s*\(/g
    ];

    return this.countPatterns(code, [...setupPatterns, ...teardownPatterns]);
  }

  private calculateTestIsolationScore(code: string): number {
    const isolationViolations = this.countPatterns(code, [
      /global\./g,
      /window\./g,
      /process\.env/g,
      /require\.cache/g,
      /module\.exports/g
    ]);

    const totalTests = this.countPatterns(code, [
      /it\s*\(/g,
      /test\s*\(/g,
      /spec\s*\(/g
    ]);

    if (totalTests === 0) return 1.0;
    return Math.max(0, 1 - (isolationViolations / totalTests));
  }

  private calculateTimingSensitivity(code: string): number {
    const timingPatterns = [
      ...this.FLAKY_PATTERNS.TIMING_DEPENDENCY,
      ...this.FLAKY_PATTERNS.HARDCODED_DELAYS
    ];

    const timingOccurrences = this.countPatterns(code, timingPatterns);
    const totalLines = code.split('\n').length;

    return timingOccurrences / Math.max(totalLines, 1);
  }

  private getDefaultFeatures(): StaticCodeFeatures {
    return {
      cyclomaticComplexity: 0,
      cognitiveComplexity: 0,
      nestingDepth: 0,
      linesOfCode: 0,
      asyncAwaitCount: 0,
      promiseChainCount: 0,
      timeoutCount: 0,
      setIntervalCount: 0,
      httpCallCount: 0,
      fileSystemCount: 0,
      databaseQueryCount: 0,
      externalServiceCount: 0,
      setupTeardownComplexity: 0,
      sharedStateUsage: 0,
      testIsolationScore: 1.0,
      hardcodedDelays: 0,
      raceConditionPatterns: 0,
      timingSensitivity: 0.0,
      resourceLeakRisk: 0.0
    };
  }

  public generateFileHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  public isTestFile(filePath: string, content: string): boolean {
    const testFilePatterns = [
      /\.test\./,
      /\.spec\./,
      /__tests__/,
      /\/tests?\//,
      /\/spec\//
    ];

    const hasTestPattern = testFilePatterns.some(pattern => pattern.test(filePath));
    
    if (hasTestPattern) return true;

    // Check content for test framework patterns
    const hasTestFramework = Object.values(this.TEST_FRAMEWORK_PATTERNS).some(patterns =>
      patterns.some(pattern => pattern.test(content))
    );

    return hasTestFramework;
  }
}