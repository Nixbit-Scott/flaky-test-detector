package dev.nixbit.jenkins;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Represents a single test result for Nixbit API
 */
public class NixbitTestResult {
    
    @JsonProperty("name")
    private String name;
    
    @JsonProperty("suite")
    private String suite;
    
    @JsonProperty("status")
    private String status; // "passed", "failed", "skipped"
    
    @JsonProperty("duration")
    private long duration; // in milliseconds
    
    @JsonProperty("errorMessage")
    private String errorMessage;
    
    @JsonProperty("stackTrace")
    private String stackTrace;
    
    @JsonProperty("retryCount")
    private int retryCount;
    
    @JsonProperty("filePath")
    private String filePath;
    
    @JsonProperty("className")
    private String className;
    
    @JsonProperty("methodName")
    private String methodName;
    
    // Constructors
    public NixbitTestResult() {
    }
    
    public NixbitTestResult(String name, String suite, String status, long duration) {
        this.name = name;
        this.suite = suite;
        this.status = status;
        this.duration = duration;
        this.retryCount = 0;
    }
    
    // Getters and setters
    public String getName() {
        return name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public String getSuite() {
        return suite;
    }
    
    public void setSuite(String suite) {
        this.suite = suite;
    }
    
    public String getStatus() {
        return status;
    }
    
    public void setStatus(String status) {
        this.status = status;
    }
    
    public long getDuration() {
        return duration;
    }
    
    public void setDuration(long duration) {
        this.duration = duration;
    }
    
    public String getErrorMessage() {
        return errorMessage;
    }
    
    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }
    
    public String getStackTrace() {
        return stackTrace;
    }
    
    public void setStackTrace(String stackTrace) {
        this.stackTrace = stackTrace;
    }
    
    public int getRetryCount() {
        return retryCount;
    }
    
    public void setRetryCount(int retryCount) {
        this.retryCount = retryCount;
    }
    
    public String getFilePath() {
        return filePath;
    }
    
    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }
    
    public String getClassName() {
        return className;
    }
    
    public void setClassName(String className) {
        this.className = className;
    }
    
    public String getMethodName() {
        return methodName;
    }
    
    public void setMethodName(String methodName) {
        this.methodName = methodName;
    }
    
    @Override
    public String toString() {
        return String.format("NixbitTestResult{name='%s', suite='%s', status='%s', duration=%d}", 
            name, suite, status, duration);
    }
}