package dev.nixbit.jenkins;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Response from Nixbit API
 */
public class NixbitApiResponse {
    
    @JsonProperty("success")
    private boolean success;
    
    @JsonProperty("message")
    private String message;
    
    @JsonProperty("testRunId")
    private String testRunId;
    
    @JsonProperty("projectId")
    private String projectId;
    
    @JsonProperty("flakyTests")
    private List<String> flakyTests;
    
    @JsonProperty("retryRecommendations")
    private List<NixbitRetryRecommendation> retryRecommendations;
    
    @JsonProperty("analytics")
    private NixbitAnalytics analytics;
    
    // Non-JSON fields
    private int statusCode;
    private String errorMessage;
    
    // Constructors
    public NixbitApiResponse() {
    }
    
    // Getters and setters
    public boolean isSuccess() {
        return success;
    }
    
    public void setSuccess(boolean success) {
        this.success = success;
    }
    
    public String getMessage() {
        return message;
    }
    
    public void setMessage(String message) {
        this.message = message;
    }
    
    public String getTestRunId() {
        return testRunId;
    }
    
    public void setTestRunId(String testRunId) {
        this.testRunId = testRunId;
    }
    
    public String getProjectId() {
        return projectId;
    }
    
    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }
    
    public List<String> getFlakyTests() {
        return flakyTests;
    }
    
    public void setFlakyTests(List<String> flakyTests) {
        this.flakyTests = flakyTests;
    }
    
    public List<NixbitRetryRecommendation> getRetryRecommendations() {
        return retryRecommendations;
    }
    
    public void setRetryRecommendations(List<NixbitRetryRecommendation> retryRecommendations) {
        this.retryRecommendations = retryRecommendations;
    }
    
    public NixbitAnalytics getAnalytics() {
        return analytics;
    }
    
    public void setAnalytics(NixbitAnalytics analytics) {
        this.analytics = analytics;
    }
    
    public int getStatusCode() {
        return statusCode;
    }
    
    public void setStatusCode(int statusCode) {
        this.statusCode = statusCode;
    }
    
    public String getErrorMessage() {
        return errorMessage;
    }
    
    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }
}


/**
 * Retry recommendation from Nixbit API
 */
class NixbitRetryRecommendation {
    
    @JsonProperty("testName")
    private String testName;
    
    @JsonProperty("confidence")
    private double confidence;
    
    @JsonProperty("recommendedDelay")
    private int recommendedDelay;
    
    @JsonProperty("maxRetries")
    private int maxRetries;
    
    @JsonProperty("reason")
    private String reason;
    
    // Constructors
    public NixbitRetryRecommendation() {
    }
    
    // Getters and setters
    public String getTestName() {
        return testName;
    }
    
    public void setTestName(String testName) {
        this.testName = testName;
    }
    
    public double getConfidence() {
        return confidence;
    }
    
    public void setConfidence(double confidence) {
        this.confidence = confidence;
    }
    
    public int getRecommendedDelay() {
        return recommendedDelay;
    }
    
    public void setRecommendedDelay(int recommendedDelay) {
        this.recommendedDelay = recommendedDelay;
    }
    
    public int getMaxRetries() {
        return maxRetries;
    }
    
    public void setMaxRetries(int maxRetries) {
        this.maxRetries = maxRetries;
    }
    
    public String getReason() {
        return reason;
    }
    
    public void setReason(String reason) {
        this.reason = reason;
    }
}


/**
 * Analytics data from Nixbit API
 */
class NixbitAnalytics {
    
    @JsonProperty("flakyTestCount")
    private int flakyTestCount;
    
    @JsonProperty("flakiness-rate")
    private double flakinessRate;
    
    @JsonProperty("stabilityScore")
    private double stabilityScore;
    
    @JsonProperty("riskLevel")
    private String riskLevel; // "low", "medium", "high"
    
    @JsonProperty("estimatedTimeWasted")
    private long estimatedTimeWasted; // in minutes
    
    @JsonProperty("recommendations")
    private List<String> recommendations;
    
    // Constructors
    public NixbitAnalytics() {
    }
    
    // Getters and setters
    public int getFlakyTestCount() {
        return flakyTestCount;
    }
    
    public void setFlakyTestCount(int flakyTestCount) {
        this.flakyTestCount = flakyTestCount;
    }
    
    public double getFlakinessRate() {
        return flakinessRate;
    }
    
    public void setFlakinessRate(double flakinessRate) {
        this.flakinessRate = flakinessRate;
    }
    
    public double getStabilityScore() {
        return stabilityScore;
    }
    
    public void setStabilityScore(double stabilityScore) {
        this.stabilityScore = stabilityScore;
    }
    
    public String getRiskLevel() {
        return riskLevel;
    }
    
    public void setRiskLevel(String riskLevel) {
        this.riskLevel = riskLevel;
    }
    
    public long getEstimatedTimeWasted() {
        return estimatedTimeWasted;
    }
    
    public void setEstimatedTimeWasted(long estimatedTimeWasted) {
        this.estimatedTimeWasted = estimatedTimeWasted;
    }
    
    public List<String> getRecommendations() {
        return recommendations;
    }
    
    public void setRecommendations(List<String> recommendations) {
        this.recommendations = recommendations;
    }
}