package dev.nixbit.jenkins;

import hudson.model.Action;
import hudson.model.Run;

/**
 * Build action to display Nixbit results in Jenkins UI
 */
public class NixbitBuildAction implements Action {
    
    private final NixbitApiResponse response;
    private final Run<?, ?> run;
    
    public NixbitBuildAction(NixbitApiResponse response) {
        this.response = response;
        this.run = null;
    }
    
    public NixbitBuildAction(NixbitApiResponse response, Run<?, ?> run) {
        this.response = response;
        this.run = run;
    }
    
    @Override
    public String getIconFileName() {
        // Return path to icon file (16x16 PNG)
        return "/plugin/nixbit-flaky-test-detector/images/nixbit-icon.png";
    }
    
    @Override
    public String getDisplayName() {
        return "Nixbit Flaky Test Analysis";
    }
    
    @Override
    public String getUrlName() {
        return "nixbit";
    }
    
    /**
     * Get the API response data
     */
    public NixbitApiResponse getResponse() {
        return response;
    }
    
    /**
     * Get the build run
     */
    public Run<?, ?> getRun() {
        return run;
    }
    
    /**
     * Check if analysis was successful
     */
    public boolean isSuccess() {
        return response != null && response.isSuccess();
    }
    
    /**
     * Get flaky test count
     */
    public int getFlakyTestCount() {
        if (response != null && response.getFlakyTests() != null) {
            return response.getFlakyTests().size();
        }
        return 0;
    }
    
    /**
     * Get flaky tests list
     */
    public java.util.List<String> getFlakyTests() {
        if (response != null && response.getFlakyTests() != null) {
            return response.getFlakyTests();
        }
        return java.util.Collections.emptyList();
    }
    
    /**
     * Get analytics data
     */
    public NixbitAnalytics getAnalytics() {
        if (response != null) {
            return response.getAnalytics();
        }
        return null;
    }
    
    /**
     * Get risk level for display
     */
    public String getRiskLevel() {
        NixbitAnalytics analytics = getAnalytics();
        if (analytics != null) {
            return analytics.getRiskLevel();
        }
        return "unknown";
    }
    
    /**
     * Get risk level CSS class for styling
     */
    public String getRiskLevelClass() {
        String riskLevel = getRiskLevel();
        switch (riskLevel.toLowerCase()) {
            case "low":
                return "nixbit-risk-low";
            case "medium":
                return "nixbit-risk-medium";
            case "high":
                return "nixbit-risk-high";
            default:
                return "nixbit-risk-unknown";
        }
    }
    
    /**
     * Get stability score as percentage
     */
    public String getStabilityScorePercent() {
        NixbitAnalytics analytics = getAnalytics();
        if (analytics != null) {
            return String.format("%.1f%%", analytics.getStabilityScore() * 100);
        }
        return "N/A";
    }
    
    /**
     * Get estimated time wasted in human readable format
     */
    public String getEstimatedTimeWasted() {
        NixbitAnalytics analytics = getAnalytics();
        if (analytics != null) {
            long minutes = analytics.getEstimatedTimeWasted();
            if (minutes < 60) {
                return minutes + " minutes";
            } else if (minutes < 1440) { // less than 24 hours
                return String.format("%.1f hours", minutes / 60.0);
            } else {
                return String.format("%.1f days", minutes / 1440.0);
            }
        }
        return "N/A";
    }
    
    /**
     * Get retry recommendations
     */
    public java.util.List<NixbitRetryRecommendation> getRetryRecommendations() {
        if (response != null && response.getRetryRecommendations() != null) {
            return response.getRetryRecommendations();
        }
        return java.util.Collections.emptyList();
    }
    
    /**
     * Check if there are any recommendations
     */
    public boolean hasRecommendations() {
        NixbitAnalytics analytics = getAnalytics();
        return analytics != null && analytics.getRecommendations() != null && 
               !analytics.getRecommendations().isEmpty();
    }
    
    /**
     * Get general recommendations
     */
    public java.util.List<String> getRecommendations() {
        NixbitAnalytics analytics = getAnalytics();
        if (analytics != null && analytics.getRecommendations() != null) {
            return analytics.getRecommendations();
        }
        return java.util.Collections.emptyList();
    }
    
    /**
     * Get error message if analysis failed
     */
    public String getErrorMessage() {
        if (response != null) {
            return response.getErrorMessage();
        }
        return null;
    }
    
    /**
     * Check if there were any errors
     */
    public boolean hasError() {
        return !isSuccess() && getErrorMessage() != null;
    }
}