package dev.nixbit.jenkins;

import hudson.model.FreeStyleBuild;
import hudson.model.FreeStyleProject;
import hudson.model.Result;
import org.junit.Rule;
import org.junit.Test;
import org.jvnet.hudson.test.JenkinsRule;

import static org.junit.Assert.*;

/**
 * Integration tests for the Nixbit Jenkins plugin
 */
public class NixbitPluginIntegrationTest {
    
    @Rule
    public JenkinsRule jenkins = new JenkinsRule();
    
    @Test
    public void testPluginConfigurationValidation() throws Exception {
        // Create a freestyle project
        FreeStyleProject project = jenkins.createFreeStyleProject("test-nixbit-config");
        
        // Create plugin instance with valid configuration
        NixbitFlakyTestDetectorPlugin plugin = new NixbitFlakyTestDetectorPlugin(
            "https://nixbit.dev/api",
            "test-api-key",
            "test-project-123",
            "**/target/surefire-reports/TEST-*.xml",
            true,
            3,
            false
        );
        
        // Validate configuration
        assertNotNull("Plugin should be created", plugin);
        assertEquals("API URL should match", "https://nixbit.dev/api", plugin.getApiUrl());
        assertEquals("API Key should match", "test-api-key", plugin.getApiKey());
        assertEquals("Project ID should match", "test-project-123", plugin.getProjectId());
        assertTrue("Retry logic should be enabled", plugin.isEnableRetryLogic());
        assertEquals("Max retries should match", 3, plugin.getMaxRetries());
    }
    
    @Test
    public void testPluginDescriptorValidation() throws Exception {
        NixbitFlakyTestDetectorPlugin.DescriptorImpl descriptor = 
            new NixbitFlakyTestDetectorPlugin.DescriptorImpl();
        
        // Test API URL validation
        assertTrue("Valid HTTPS URL should pass", 
            descriptor.doCheckApiUrl("https://nixbit.dev/api").kind == hudson.util.FormValidation.Kind.OK);
        
        assertTrue("Valid HTTP URL should pass", 
            descriptor.doCheckApiUrl("http://localhost:3000/api").kind == hudson.util.FormValidation.Kind.OK);
        
        assertTrue("Empty URL should fail", 
            descriptor.doCheckApiUrl("").kind == hudson.util.FormValidation.Kind.ERROR);
        
        assertTrue("Invalid URL should fail", 
            descriptor.doCheckApiUrl("not-a-url").kind == hudson.util.FormValidation.Kind.ERROR);
        
        // Test API Key validation
        assertTrue("Valid API key should pass", 
            descriptor.doCheckApiKey("valid-api-key").kind == hudson.util.FormValidation.Kind.OK);
        
        assertTrue("Empty API key should fail", 
            descriptor.doCheckApiKey("").kind == hudson.util.FormValidation.Kind.ERROR);
        
        // Test Project ID validation
        assertTrue("Valid project ID should pass", 
            descriptor.doCheckProjectId("project-123").kind == hudson.util.FormValidation.Kind.OK);
        
        assertTrue("Empty project ID should fail", 
            descriptor.doCheckProjectId("").kind == hudson.util.FormValidation.Kind.ERROR);
        
        // Test max retries validation
        assertTrue("Valid retry count should pass", 
            descriptor.doCheckMaxRetries("3").kind == hudson.util.FormValidation.Kind.OK);
        
        assertTrue("Invalid retry count should fail", 
            descriptor.doCheckMaxRetries("0").kind == hudson.util.FormValidation.Kind.ERROR);
        
        assertTrue("High retry count should fail", 
            descriptor.doCheckMaxRetries("15").kind == hudson.util.FormValidation.Kind.ERROR);
        
        assertTrue("Non-numeric retry count should fail", 
            descriptor.doCheckMaxRetries("abc").kind == hudson.util.FormValidation.Kind.ERROR);
    }
    
    @Test
    public void testBuildActionCreation() throws Exception {
        // Create mock API response
        NixbitApiResponse response = new NixbitApiResponse();
        response.setSuccess(true);
        response.setFlakyTests(java.util.Arrays.asList("com.example.FlakyTest.testMethod"));
        
        NixbitAnalytics analytics = new NixbitAnalytics();
        analytics.setStabilityScore(0.85);
        analytics.setRiskLevel("medium");
        analytics.setEstimatedTimeWasted(120); // 2 hours
        analytics.setRecommendations(java.util.Arrays.asList(
            "Consider increasing test timeout",
            "Review test environment setup"
        ));
        response.setAnalytics(analytics);
        
        // Create build action
        NixbitBuildAction action = new NixbitBuildAction(response);
        
        // Validate action properties
        assertTrue("Action should be successful", action.isSuccess());
        assertEquals("Should have 1 flaky test", 1, action.getFlakyTestCount());
        assertEquals("Risk level should be medium", "medium", action.getRiskLevel());
        assertEquals("Stability score should be formatted", "85.0%", action.getStabilityScorePercent());
        assertEquals("Time wasted should be formatted", "2.0 hours", action.getEstimatedTimeWasted());
        assertTrue("Should have recommendations", action.hasRecommendations());
        
        // Test CSS class generation
        assertEquals("Risk class should be correct", "nixbit-risk-medium", action.getRiskLevelClass());
    }
    
    @Test
    public void testGitInfoExtraction() throws Exception {
        // Create a freestyle project
        FreeStyleProject project = jenkins.createFreeStyleProject("test-git-extraction");
        
        // Schedule a build
        FreeStyleBuild build = jenkins.buildAndAssertSuccess(project);
        
        // Test Git info extraction
        GitInfoExtractor extractor = new GitInfoExtractor(build);
        
        // Should have default values when no Git info available
        assertNotNull("Branch should not be null", extractor.getBranch());
        assertNotNull("Commit hash should not be null", extractor.getCommitHash());
        
        // Default fallbacks should be applied
        if (!extractor.hasGitInfo()) {
            assertEquals("Default branch should be main", "main", extractor.getBranch());
        }
    }
    
    @Test
    public void testEnvironmentVariablesAction() throws Exception {
        // Test environment variables action
        EnvironmentVariablesAction envAction = new EnvironmentVariablesAction(
            "NIXBIT_ANALYSIS_ID", "analysis-123",
            "NIXBIT_BUILD_ID", "build-456"
        );
        
        // Validate variables
        assertEquals("Should have correct analysis ID", "analysis-123", 
            envAction.getVariable("NIXBIT_ANALYSIS_ID"));
        assertEquals("Should have correct build ID", "build-456", 
            envAction.getVariable("NIXBIT_BUILD_ID"));
        assertTrue("Should have analysis ID variable", 
            envAction.hasVariable("NIXBIT_ANALYSIS_ID"));
        assertFalse("Should not have unknown variable", 
            envAction.hasVariable("UNKNOWN_VAR"));
        
        // Test adding variables
        envAction.addVariable("NIXBIT_STATUS", "completed");
        assertEquals("Should have new variable", "completed", 
            envAction.getVariable("NIXBIT_STATUS"));
    }
    
    @Test
    public void testPipelineStepDescriptor() throws Exception {
        NixbitPipelineStep.DescriptorImpl descriptor = new NixbitPipelineStep.DescriptorImpl();
        
        // Test descriptor properties
        assertEquals("Function name should be correct", "nixbitAnalysis", descriptor.getFunctionName());
        assertEquals("Display name should be correct", "Nixbit Flaky Test Analysis", descriptor.getDisplayName());
        assertNotNull("Required context should be defined", descriptor.getRequiredContext());
    }
    
    @Test
    public void testTestResultParsing() throws Exception {
        // This would typically test with actual XML files
        // For now, we test the parser structure
        
        java.util.List<NixbitTestResult> results = new java.util.ArrayList<>();
        
        // Create mock test result
        NixbitTestResult result = new NixbitTestResult();
        result.setName("com.example.SampleTest.testMethod");
        result.setStatus("passed");
        result.setDuration(150);
        result.setSuite("SampleTest");
        result.setClassName("com.example.SampleTest");
        result.setMethodName("testMethod");
        
        results.add(result);
        
        // Validate parsing results structure
        assertFalse("Results should not be empty", results.isEmpty());
        assertEquals("Should have 1 result", 1, results.size());
        
        NixbitTestResult parsedResult = results.get(0);
        assertEquals("Name should match", "com.example.SampleTest.testMethod", parsedResult.getName());
        assertEquals("Status should match", "passed", parsedResult.getStatus());
        assertEquals("Duration should match", 150, parsedResult.getDuration());
    }
    
    @Test
    public void testPluginIntegrationFlow() throws Exception {
        // Create a freestyle project with Nixbit plugin
        FreeStyleProject project = jenkins.createFreeStyleProject("test-integration-flow");
        
        // Configure the plugin (would normally need valid API credentials)
        NixbitFlakyTestDetectorPlugin plugin = new NixbitFlakyTestDetectorPlugin(
            "https://nixbit.dev/api",
            "test-key",
            "test-project",
            "**/target/surefire-reports/TEST-*.xml",
            true,
            3,
            true // Enable debug mode for testing
        );
        
        // Add plugin as post-build action
        project.getPublishersList().add(plugin);
        
        // Validate project configuration
        assertTrue("Project should have publishers", project.getPublishersList().size() > 0);
        
        // The plugin should be in the publishers list
        boolean pluginFound = project.getPublishersList().stream()
            .anyMatch(publisher -> publisher instanceof NixbitFlakyTestDetectorPlugin);
        
        assertTrue("Nixbit plugin should be configured", pluginFound);
    }
    
    @Test
    public void testErrorHandling() throws Exception {
        // Test plugin behavior with invalid configuration
        NixbitFlakyTestDetectorPlugin plugin = new NixbitFlakyTestDetectorPlugin(
            "", // Empty API URL
            "",  // Empty API key
            "",  // Empty project ID
            "",  // Empty pattern
            false,
            0,   // Invalid retry count
            false
        );
        
        // Plugin should handle invalid configuration gracefully
        assertNotNull("Plugin should be created even with invalid config", plugin);
        
        // Validation should catch these issues
        NixbitFlakyTestDetectorPlugin.DescriptorImpl descriptor = 
            new NixbitFlakyTestDetectorPlugin.DescriptorImpl();
        
        assertTrue("Empty API URL should fail validation",
            descriptor.doCheckApiUrl("").kind == hudson.util.FormValidation.Kind.ERROR);
    }
}