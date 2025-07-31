package dev.nixbit.jenkins;

import hudson.Extension;
import hudson.FilePath;
import hudson.Launcher;
import hudson.model.Run;
import hudson.model.TaskListener;
import hudson.util.FormValidation;
import org.jenkinsci.plugins.workflow.steps.Step;
import org.jenkinsci.plugins.workflow.steps.StepContext;
import org.jenkinsci.plugins.workflow.steps.StepDescriptor;
import org.jenkinsci.plugins.workflow.steps.StepExecution;
import org.jenkinsci.plugins.workflow.steps.SynchronousNonBlockingStepExecution;
import org.kohsuke.stapler.DataBoundConstructor;
import org.kohsuke.stapler.DataBoundSetter;
import org.kohsuke.stapler.QueryParameter;

import javax.annotation.Nonnull;
import java.io.Serializable;
import java.util.Collections;
import java.util.Set;
import java.util.logging.Logger;

/**
 * Jenkins Pipeline step for Nixbit flaky test detection
 * 
 * Usage examples:
 * 
 * nixbitAnalysis()
 * 
 * nixbitAnalysis(
 *   apiUrl: 'https://nixbit.dev/api',
 *   apiKey: credentials('nixbit-api-key'),
 *   projectId: 'my-project-123',
 *   testReportPattern: '**/target/surefire-reports/TEST-*.xml',
 *   enableRetryLogic: true,
 *   maxRetries: 3
 * )
 */
public class NixbitPipelineStep extends Step implements Serializable {
    
    private static final Logger LOGGER = Logger.getLogger(NixbitPipelineStep.class.getName());
    private static final long serialVersionUID = 1L;
    
    private String apiUrl = "https://nixbit.dev/api";
    private String apiKey;
    private String projectId;
    private String testReportPattern = "**/target/surefire-reports/TEST-*.xml,**/build/test-results/test/TEST-*.xml";
    private boolean enableRetryLogic = true;
    private int maxRetries = 3;
    private boolean debugMode = false;
    
    @DataBoundConstructor
    public NixbitPipelineStep() {
        // Default constructor
    }
    
    @DataBoundSetter
    public void setApiUrl(String apiUrl) {
        this.apiUrl = apiUrl;
    }
    
    @DataBoundSetter
    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }
    
    @DataBoundSetter
    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }
    
    @DataBoundSetter
    public void setTestReportPattern(String testReportPattern) {
        this.testReportPattern = testReportPattern;
    }
    
    @DataBoundSetter
    public void setEnableRetryLogic(boolean enableRetryLogic) {
        this.enableRetryLogic = enableRetryLogic;
    }
    
    @DataBoundSetter
    public void setMaxRetries(int maxRetries) {
        this.maxRetries = maxRetries;
    }
    
    @DataBoundSetter
    public void setDebugMode(boolean debugMode) {
        this.debugMode = debugMode;
    }
    
    // Getters
    public String getApiUrl() { return apiUrl; }
    public String getApiKey() { return apiKey; }
    public String getProjectId() { return projectId; }
    public String getTestReportPattern() { return testReportPattern; }
    public boolean isEnableRetryLogic() { return enableRetryLogic; }
    public int getMaxRetries() { return maxRetries; }
    public boolean isDebugMode() { return debugMode; }
    
    @Override
    public StepExecution start(StepContext context) throws Exception {
        return new NixbitPipelineStepExecution(this, context);
    }
    
    /**
     * Step execution implementation
     */
    public static class NixbitPipelineStepExecution extends SynchronousNonBlockingStepExecution<NixbitApiResponse> {
        
        private static final long serialVersionUID = 1L;
        private final NixbitPipelineStep step;
        
        public NixbitPipelineStepExecution(NixbitPipelineStep step, StepContext context) {
            super(context);
            this.step = step;
        }
        
        @Override
        protected NixbitApiResponse run() throws Exception {
            Run<?, ?> run = getContext().get(Run.class);
            FilePath workspace = getContext().get(FilePath.class);
            Launcher launcher = getContext().get(Launcher.class);
            TaskListener listener = getContext().get(TaskListener.class);
            
            if (step.debugMode) {
                listener.getLogger().println("[Nixbit Pipeline] Starting flaky test analysis...");
                listener.getLogger().println("[Nixbit Pipeline] API URL: " + step.apiUrl);
                listener.getLogger().println("[Nixbit Pipeline] Project ID: " + step.projectId);
                listener.getLogger().println("[Nixbit Pipeline] Test Report Pattern: " + step.testReportPattern);
            }
            
            try {
                // Create a temporary plugin instance to reuse existing logic
                NixbitFlakyTestDetectorPlugin plugin = new NixbitFlakyTestDetectorPlugin(
                    step.apiUrl,
                    step.apiKey,
                    step.projectId,
                    step.testReportPattern,
                    step.enableRetryLogic,
                    step.maxRetries,
                    step.debugMode
                );
                
                // Execute the analysis
                boolean success = plugin.perform(run, workspace, launcher, listener);
                
                // Get the build action that was added
                NixbitBuildAction action = run.getAction(NixbitBuildAction.class);
                
                if (action != null) {
                    NixbitApiResponse response = action.getResponse();
                    
                    if (step.debugMode) {
                        listener.getLogger().println("[Nixbit Pipeline] Analysis completed successfully");
                        listener.getLogger().println("[Nixbit Pipeline] Flaky tests found: " + action.getFlakyTestCount());
                        listener.getLogger().println("[Nixbit Pipeline] Risk level: " + action.getRiskLevel());
                    }
                    
                    return response;
                } else {
                    // Create a failure response
                    NixbitApiResponse failureResponse = new NixbitApiResponse();
                    failureResponse.setSuccess(false);
                    failureResponse.setErrorMessage("Analysis failed - no response available");
                    
                    if (step.debugMode) {
                        listener.getLogger().println("[Nixbit Pipeline] Analysis failed - no build action found");
                    }
                    
                    return failureResponse;
                }
                
            } catch (Exception e) {
                listener.getLogger().println("[Nixbit Pipeline] Error during analysis: " + e.getMessage());
                
                if (step.debugMode) {
                    e.printStackTrace(listener.getLogger());
                }
                
                // Create an error response
                NixbitApiResponse errorResponse = new NixbitApiResponse();
                errorResponse.setSuccess(false);
                errorResponse.setErrorMessage("Analysis error: " + e.getMessage());
                
                return errorResponse;
            }
        }
    }
    
    /**
     * Descriptor for pipeline step
     */
    @Extension
    public static class DescriptorImpl extends StepDescriptor {
        
        @Override
        public Set<? extends Class<?>> getRequiredContext() {
            return Collections.emptySet();
        }
        
        @Override
        public String getFunctionName() {
            return "nixbitAnalysis";
        }
        
        @Override
        @Nonnull
        public String getDisplayName() {
            return "Nixbit Flaky Test Analysis";
        }
        
        /**
         * Form validation for API URL
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
         * Form validation for API Key
         */
        public FormValidation doCheckApiKey(@QueryParameter String value) {
            if (value == null || value.trim().isEmpty()) {
                return FormValidation.error("API Key is required");
            }
            
            return FormValidation.ok();
        }
        
        /**
         * Form validation for Project ID
         */
        public FormValidation doCheckProjectId(@QueryParameter String value) {
            if (value == null || value.trim().isEmpty()) {
                return FormValidation.error("Project ID is required");
            }
            
            return FormValidation.ok();
        }
        
        /**
         * Form validation for max retries
         */
        public FormValidation doCheckMaxRetries(@QueryParameter String value) {
            try {
                int retries = Integer.parseInt(value);
                if (retries < 1 || retries > 10) {
                    return FormValidation.error("Max retries must be between 1 and 10");
                }
                return FormValidation.ok();
            } catch (NumberFormatException e) {
                return FormValidation.error("Max retries must be a valid number");
            }
        }
        
        /**
         * Test connection to Nixbit API
         */
        public FormValidation doTestConnection(@QueryParameter String apiUrl, 
                                             @QueryParameter String apiKey) {
            if (apiUrl == null || apiUrl.trim().isEmpty()) {
                return FormValidation.error("API URL is required");
            }
            
            if (apiKey == null || apiKey.trim().isEmpty()) {
                return FormValidation.error("API Key is required");
            }
            
            try {
                NixbitApiClient client = new NixbitApiClient(apiUrl.trim(), apiKey.trim());
                boolean connected = client.testConnection();
                
                if (connected) {
                    return FormValidation.ok("✅ Connection successful!");
                } else {
                    return FormValidation.error("❌ Connection failed - check your API URL and key");
                }
                
            } catch (Exception e) {
                return FormValidation.error("❌ Connection error: " + e.getMessage());
            }
        }
    }
}