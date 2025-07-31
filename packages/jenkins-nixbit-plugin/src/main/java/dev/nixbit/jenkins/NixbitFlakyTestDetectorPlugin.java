package dev.nixbit.jenkins;

import hudson.Extension;
import hudson.Launcher;
import hudson.model.*;
import hudson.tasks.BuildStepDescriptor;
import hudson.tasks.BuildStepMonitor;
import hudson.tasks.Publisher;
import hudson.tasks.Recorder;
import hudson.tasks.junit.TestResult;
import hudson.tasks.junit.TestResultAction;
import hudson.util.FormValidation;
import jenkins.tasks.SimpleBuildStep;
import org.jenkinsci.Symbol;
import org.kohsuke.stapler.DataBoundConstructor;
import org.kohsuke.stapler.DataBoundSetter;
import org.kohsuke.stapler.QueryParameter;

import javax.annotation.Nonnull;
import java.io.IOException;
import java.io.PrintStream;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Logger;

/**
 * Jenkins plugin for integrating with Nixbit flaky test detection platform.
 * 
 * This plugin automatically sends test results to Nixbit for AI-powered flaky test detection,
 * provides intelligent retry logic, and generates comprehensive test analytics.
 */
public class NixbitFlakyTestDetectorPlugin extends Recorder implements SimpleBuildStep {
    
    private static final Logger LOGGER = Logger.getLogger(NixbitFlakyTestDetectorPlugin.class.getName());
    
    // Configuration fields
    private String apiUrl;
    private String apiKey;
    private String projectId;
    private boolean enableRetryLogic;
    private int maxRetries;
    private String testReportPattern;
    private boolean debugMode;
    
    @DataBoundConstructor
    public NixbitFlakyTestDetectorPlugin() {
        // Default values
        this.apiUrl = "https://nixbit.dev/api";
        this.enableRetryLogic = true;
        this.maxRetries = 3;
        this.testReportPattern = "**/target/surefire-reports/TEST-*.xml,**/build/test-results/test/TEST-*.xml";
        this.debugMode = false;
    }
    
    // Getters and setters for configuration
    public String getApiUrl() {
        return apiUrl;
    }
    
    @DataBoundSetter
    public void setApiUrl(String apiUrl) {
        this.apiUrl = apiUrl;
    }
    
    public String getApiKey() {
        return apiKey;
    }
    
    @DataBoundSetter
    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }
    
    public String getProjectId() {
        return projectId;
    }
    
    @DataBoundSetter
    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }
    
    public boolean isEnableRetryLogic() {
        return enableRetryLogic;
    }
    
    @DataBoundSetter
    public void setEnableRetryLogic(boolean enableRetryLogic) {
        this.enableRetryLogic = enableRetryLogic;
    }
    
    public int getMaxRetries() {
        return maxRetries;
    }
    
    @DataBoundSetter
    public void setMaxRetries(int maxRetries) {
        this.maxRetries = maxRetries;
    }
    
    public String getTestReportPattern() {
        return testReportPattern;
    }
    
    @DataBoundSetter
    public void setTestReportPattern(String testReportPattern) {
        this.testReportPattern = testReportPattern;
    }
    
    public boolean isDebugMode() {
        return debugMode;
    }
    
    @DataBoundSetter
    public void setDebugMode(boolean debugMode) {
        this.debugMode = debugMode;
    }
    
    @Override
    public void perform(@Nonnull Run<?, ?> run, @Nonnull FilePath workspace, 
                       @Nonnull Launcher launcher, @Nonnull TaskListener listener) 
            throws InterruptedException, IOException {
        
        PrintStream logger = listener.getLogger();
        logger.println("[Nixbit] Starting flaky test detection analysis...");
        
        try {
            // Validate configuration
            if (!validateConfiguration(logger)) {
                run.setResult(Result.UNSTABLE);
                return;
            }
            
            // Extract test results
            List<NixbitTestResult> testResults = extractTestResults(run, workspace, logger);
            
            if (testResults.isEmpty()) {
                logger.println("[Nixbit] No test results found to analyze");
                return;
            }
            
            logger.println(String.format("[Nixbit] Found %d test results to analyze", testResults.size()));
            
            // Send results to Nixbit API
            NixbitApiClient apiClient = new NixbitApiClient(apiUrl, apiKey, debugMode);
            NixbitTestRun testRun = createTestRun(run, testResults);
            
            NixbitApiResponse response = apiClient.submitTestResults(testRun);
            
            if (response.isSuccess()) {
                logger.println(String.format("[Nixbit] Successfully submitted test results. Response: %s", 
                    response.getMessage()));
                
                // Process flaky test recommendations
                processRetryRecommendations(response, run, logger);
                
                // Add build action for UI display
                run.addAction(new NixbitBuildAction(response));
                
            } else {
                logger.println(String.format("[Nixbit] Failed to submit test results: %s", 
                    response.getErrorMessage()));
                
                if (response.getStatusCode() >= 500) {
                    // Server error - don't fail the build
                    logger.println("[Nixbit] Server error encountered, continuing build...");
                } else {
                    // Client error - might indicate configuration issues
                    run.setResult(Result.UNSTABLE);
                }
            }
            
        } catch (Exception e) {
            logger.println(String.format("[Nixbit] Error during flaky test analysis: %s", e.getMessage()));
            LOGGER.severe("Nixbit plugin error: " + e.getMessage());
            
            if (debugMode) {
                e.printStackTrace(logger);
            }
            
            // Don't fail the build for plugin errors
            run.setResult(Result.UNSTABLE);
        }
    }
    
    /**
     * Validate plugin configuration
     */
    private boolean validateConfiguration(PrintStream logger) {
        List<String> errors = new ArrayList<>();
        
        if (apiKey == null || apiKey.trim().isEmpty()) {
            errors.add("API Key is required");
        }
        
        if (projectId == null || projectId.trim().isEmpty()) {
            errors.add("Project ID is required");
        }
        
        if (apiUrl == null || apiUrl.trim().isEmpty()) {
            errors.add("API URL is required");
        }
        
        if (!errors.isEmpty()) {
            logger.println("[Nixbit] Configuration errors:");
            for (String error : errors) {
                logger.println("  - " + error);
            }
            return false;
        }
        
        return true;
    }
    
    /**
     * Extract test results from Jenkins test result actions
     */
    private List<NixbitTestResult> extractTestResults(Run<?, ?> run, FilePath workspace, PrintStream logger) 
            throws IOException, InterruptedException {
        
        List<NixbitTestResult> results = new ArrayList<>();
        
        // Try to get JUnit test results from existing TestResultAction
        TestResultAction testResultAction = run.getAction(TestResultAction.class);
        if (testResultAction != null) {
            TestResult testResult = testResultAction.getResult();
            results.addAll(JUnitResultParser.parseTestResult(testResult, logger, debugMode));
        }
        
        // If no existing test results, try to parse from files
        if (results.isEmpty()) {
            results.addAll(TestReportParser.parseTestReports(workspace, testReportPattern, logger, debugMode));
        }
        
        return results;
    }
    
    /**
     * Create NixbitTestRun object from Jenkins build information
     */
    private NixbitTestRun createTestRun(Run<?, ?> run, List<NixbitTestResult> testResults) {
        NixbitTestRun testRun = new NixbitTestRun();
        
        testRun.setProjectId(projectId);
        testRun.setBuildId(String.valueOf(run.getNumber()));
        testRun.setBuildUrl(run.getUrl());
        testRun.setTimestamp(run.getTimeInMillis());
        testRun.setTestResults(testResults);
        
        // Extract Git information if available
        GitInfoExtractor gitInfo = new GitInfoExtractor(run);
        testRun.setBranch(gitInfo.getBranch());
        testRun.setCommit(gitInfo.getCommitHash());
        
        // Environment information
        testRun.setJenkinsVersion(Jenkins.getVersion().toString());
        testRun.setNodeName(run.getExecutor() != null ? run.getExecutor().getOwner().getDisplayName() : "master");
        
        // Test summary
        int passed = 0, failed = 0, skipped = 0;
        long totalDuration = 0;
        
        for (NixbitTestResult result : testResults) {
            switch (result.getStatus()) {
                case "passed":
                    passed++;
                    break;
                case "failed":
                    failed++;
                    break;
                case "skipped":
                    skipped++;
                    break;
            }
            totalDuration += result.getDuration();
        }
        
        testRun.setSummary(new NixbitTestSummary(
            testResults.size(), passed, failed, skipped, totalDuration
        ));
        
        return testRun;
    }
    
    /**
     * Process retry recommendations from Nixbit API
     */
    private void processRetryRecommendations(NixbitApiResponse response, Run<?, ?> run, PrintStream logger) {
        if (!enableRetryLogic) {
            logger.println("[Nixbit] Retry logic disabled, skipping recommendations");
            return;
        }
        
        List<String> flakyTests = response.getFlakyTests();
        if (flakyTests != null && !flakyTests.isEmpty()) {
            logger.println(String.format("[Nixbit] Found %d flaky tests:", flakyTests.size()));
            
            for (String testName : flakyTests) {
                logger.println("  - " + testName);
            }
            
            // Add environment variables for retry logic in downstream builds
            EnvironmentVariablesAction envAction = new EnvironmentVariablesAction(
                "NIXBIT_FLAKY_TESTS", String.join(",", flakyTests),
                "NIXBIT_RETRY_ENABLED", "true",
                "NIXBIT_MAX_RETRIES", String.valueOf(maxRetries)
            );
            run.addAction(envAction);
            
            logger.println("[Nixbit] Environment variables set for retry logic");
        }
    }
    
    @Override
    public BuildStepMonitor getRequiredMonitorService() {
        return BuildStepMonitor.NONE;
    }
    
    @Symbol("nixbitFlakyTestDetector")
    @Extension
    public static final class DescriptorImpl extends BuildStepDescriptor<Publisher> {
        
        @Override
        public boolean isApplicable(Class<? extends AbstractProject> aClass) {
            return true;
        }
        
        @Override
        @Nonnull
        public String getDisplayName() {
            return "Nixbit Flaky Test Detector";
        }
        
        /**
         * Validate API URL
         */
        public FormValidation doCheckApiUrl(@QueryParameter String value) {
            if (value == null || value.trim().isEmpty()) {
                return FormValidation.error("API URL is required");
            }
            
            if (!value.startsWith("http://") && !value.startsWith("https://")) {
                return FormValidation.error("API URL must start with http:// or https://");
            }
            
            return FormValidation.ok();
        }
        
        /**
         * Validate API Key
         */
        public FormValidation doCheckApiKey(@QueryParameter String value) {
            if (value == null || value.trim().isEmpty()) {
                return FormValidation.error("API Key is required");
            }
            
            if (value.length() < 10) {
                return FormValidation.warning("API Key seems too short");
            }
            
            return FormValidation.ok();
        }
        
        /**
         * Validate Project ID
         */
        public FormValidation doCheckProjectId(@QueryParameter String value) {
            if (value == null || value.trim().isEmpty()) {
                return FormValidation.error("Project ID is required");
            }
            
            return FormValidation.ok();
        }
        
        /**
         * Validate max retries
         */
        public FormValidation doCheckMaxRetries(@QueryParameter String value) {
            try {
                int retries = Integer.parseInt(value);
                if (retries < 1 || retries > 10) {
                    return FormValidation.error("Max retries must be between 1 and 10");
                }
                return FormValidation.ok();
            } catch (NumberFormatException e) {
                return FormValidation.error("Must be a valid number");
            }
        }
        
        /**
         * Test connection to Nixbit API
         */
        public FormValidation doTestConnection(@QueryParameter String apiUrl, 
                                             @QueryParameter String apiKey) {
            try {
                if (apiUrl == null || apiUrl.trim().isEmpty()) {
                    return FormValidation.error("API URL is required");
                }
                
                if (apiKey == null || apiKey.trim().isEmpty()) {
                    return FormValidation.error("API Key is required");
                }
                
                NixbitApiClient client = new NixbitApiClient(apiUrl.trim(), apiKey.trim(), false);
                boolean connected = client.testConnection();
                
                if (connected) {
                    return FormValidation.ok("✅ Successfully connected to Nixbit API");
                } else {
                    return FormValidation.error("❌ Failed to connect to Nixbit API");
                }
                
            } catch (Exception e) {
                return FormValidation.error("Connection test failed: " + e.getMessage());
            }
        }
    }
}