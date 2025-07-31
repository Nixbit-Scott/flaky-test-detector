package dev.nixbit.jenkins;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Represents a complete test run for Nixbit API
 */
public class NixbitTestRun {
    
    @JsonProperty("projectId")
    private String projectId;
    
    @JsonProperty("buildId")
    private String buildId;
    
    @JsonProperty("buildUrl")
    private String buildUrl;
    
    @JsonProperty("branch")
    private String branch;
    
    @JsonProperty("commit")
    private String commit;
    
    @JsonProperty("timestamp")
    private long timestamp;
    
    @JsonProperty("jenkinsVersion")
    private String jenkinsVersion;
    
    @JsonProperty("nodeName")
    private String nodeName;
    
    @JsonProperty("summary")
    private NixbitTestSummary summary;
    
    @JsonProperty("testResults")
    private List<NixbitTestResult> testResults;
    
    @JsonProperty("environment")
    private NixbitEnvironment environment;
    
    // Constructors
    public NixbitTestRun() {
    }
    
    // Getters and setters
    public String getProjectId() {
        return projectId;
    }
    
    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }
    
    public String getBuildId() {
        return buildId;
    }
    
    public void setBuildId(String buildId) {
        this.buildId = buildId;
    }
    
    public String getBuildUrl() {
        return buildUrl;
    }
    
    public void setBuildUrl(String buildUrl) {
        this.buildUrl = buildUrl;
    }
    
    public String getBranch() {
        return branch;
    }
    
    public void setBranch(String branch) {
        this.branch = branch;
    }
    
    public String getCommit() {
        return commit;
    }
    
    public void setCommit(String commit) {
        this.commit = commit;
    }
    
    public long getTimestamp() {
        return timestamp;
    }
    
    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }
    
    public String getJenkinsVersion() {
        return jenkinsVersion;
    }
    
    public void setJenkinsVersion(String jenkinsVersion) {
        this.jenkinsVersion = jenkinsVersion;
    }
    
    public String getNodeName() {
        return nodeName;
    }
    
    public void setNodeName(String nodeName) {
        this.nodeName = nodeName;
    }
    
    public NixbitTestSummary getSummary() {
        return summary;
    }
    
    public void setSummary(NixbitTestSummary summary) {
        this.summary = summary;
    }
    
    public List<NixbitTestResult> getTestResults() {
        return testResults;
    }
    
    public void setTestResults(List<NixbitTestResult> testResults) {
        this.testResults = testResults;
    }
    
    public NixbitEnvironment getEnvironment() {
        return environment;
    }
    
    public void setEnvironment(NixbitEnvironment environment) {
        this.environment = environment;
    }
}


/**
 * Test run summary statistics
 */
class NixbitTestSummary {
    
    @JsonProperty("totalTests")
    private int totalTests;
    
    @JsonProperty("passedTests")
    private int passedTests;
    
    @JsonProperty("failedTests")
    private int failedTests;
    
    @JsonProperty("skippedTests")
    private int skippedTests;
    
    @JsonProperty("duration")
    private long duration;
    
    public NixbitTestSummary() {
    }
    
    public NixbitTestSummary(int totalTests, int passedTests, int failedTests, int skippedTests, long duration) {
        this.totalTests = totalTests;
        this.passedTests = passedTests;
        this.failedTests = failedTests;
        this.skippedTests = skippedTests;
        this.duration = duration;
    }
    
    // Getters and setters
    public int getTotalTests() {
        return totalTests;
    }
    
    public void setTotalTests(int totalTests) {
        this.totalTests = totalTests;
    }
    
    public int getPassedTests() {
        return passedTests;
    }
    
    public void setPassedTests(int passedTests) {
        this.passedTests = passedTests;
    }
    
    public int getFailedTests() {
        return failedTests;
    }
    
    public void setFailedTests(int failedTests) {
        this.failedTests = failedTests;
    }
    
    public int getSkippedTests() {
        return skippedTests;
    }
    
    public void setSkippedTests(int skippedTests) {
        this.skippedTests = skippedTests;
    }
    
    public long getDuration() {
        return duration;
    }
    
    public void setDuration(long duration) {
        this.duration = duration;
    }
}


/**
 * Environment information
 */
class NixbitEnvironment {
    
    @JsonProperty("ci")
    private boolean ci = true; // Always true for Jenkins
    
    @JsonProperty("ciSystem")
    private String ciSystem = "jenkins";
    
    @JsonProperty("platform")
    private String platform;
    
    @JsonProperty("javaVersion")
    private String javaVersion;
    
    public NixbitEnvironment() {
        this.platform = System.getProperty("os.name");
        this.javaVersion = System.getProperty("java.version");
    }
    
    // Getters and setters
    public boolean isCi() {
        return ci;
    }
    
    public void setCi(boolean ci) {
        this.ci = ci;
    }
    
    public String getCiSystem() {
        return ciSystem;
    }
    
    public void setCiSystem(String ciSystem) {
        this.ciSystem = ciSystem;
    }
    
    public String getPlatform() {
        return platform;
    }
    
    public void setPlatform(String platform) {
        this.platform = platform;
    }
    
    public String getJavaVersion() {
        return javaVersion;
    }
    
    public void setJavaVersion(String javaVersion) {
        this.javaVersion = javaVersion;
    }
}