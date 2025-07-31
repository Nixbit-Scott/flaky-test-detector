package dev.nixbit.jenkins;

import hudson.model.Run;
import hudson.plugins.git.GitSCM;
import hudson.plugins.git.util.BuildData;
import hudson.scm.SCM;
import jenkins.model.Jenkins;

import java.util.logging.Logger;

/**
 * Extracts Git information from Jenkins builds
 */
public class GitInfoExtractor {
    
    private static final Logger LOGGER = Logger.getLogger(GitInfoExtractor.class.getName());
    
    private final Run<?, ?> run;
    private String branch;
    private String commitHash;
    
    public GitInfoExtractor(Run<?, ?> run) {
        this.run = run;
        extractGitInfo();
    }
    
    /**
     * Extract Git information from the build
     */
    private void extractGitInfo() {
        try {
            // Try to get Git information from BuildData action
            BuildData buildData = run.getAction(BuildData.class);
            if (buildData != null) {
                extractFromBuildData(buildData);
                return;
            }
            
            // Try to get from environment variables
            extractFromEnvironment();
            
            // Fallback to SCM information
            if ((branch == null || commitHash == null) && run.getParent() != null) {
                extractFromSCM();
            }
            
        } catch (Exception e) {
            LOGGER.warning("Error extracting Git information: " + e.getMessage());
            setDefaults();
        }
        
        // Ensure we have some values
        if (branch == null || branch.isEmpty()) {
            branch = "main";
        }
        if (commitHash == null || commitHash.isEmpty()) {
            commitHash = "unknown";
        }
    }
    
    /**
     * Extract Git info from BuildData action (Git plugin)
     */
    private void extractFromBuildData(BuildData buildData) {
        try {
            if (buildData.getLastBuiltRevision() != null) {
                // Get commit hash
                commitHash = buildData.getLastBuiltRevision().getSha1String();
                
                // Get branch name
                if (!buildData.getLastBuiltRevision().getBranches().isEmpty()) {
                    String branchName = buildData.getLastBuiltRevision().getBranches().iterator().next().getName();
                    // Remove origin/ prefix if present
                    if (branchName.startsWith("origin/")) {
                        branchName = branchName.substring(7);
                    }
                    branch = branchName;
                }
            }
        } catch (Exception e) {
            LOGGER.warning("Error extracting from BuildData: " + e.getMessage());
        }
    }
    
    /**
     * Extract Git info from environment variables
     */
    private void extractFromEnvironment() {
        try {
            // Jenkins standard environment variables
            String gitBranch = System.getenv("GIT_BRANCH");
            String gitCommit = System.getenv("GIT_COMMIT");
            
            // GitLab CI variables
            if (gitBranch == null) {
                gitBranch = System.getenv("CI_COMMIT_REF_NAME");
            }
            if (gitCommit == null) {
                gitCommit = System.getenv("CI_COMMIT_SHA");
            }
            
            // GitHub Actions variables
            if (gitBranch == null) {
                gitBranch = System.getenv("GITHUB_REF_NAME");
            }
            if (gitCommit == null) {
                gitCommit = System.getenv("GITHUB_SHA");
            }
            
            // Other CI systems
            if (gitBranch == null) {
                gitBranch = System.getenv("BRANCH_NAME");
            }
            if (gitCommit == null) {
                gitCommit = System.getenv("BUILD_VCS_NUMBER");
            }
            
            // Clean up branch name
            if (gitBranch != null) {
                if (gitBranch.startsWith("origin/")) {
                    gitBranch = gitBranch.substring(7);
                }
                if (gitBranch.startsWith("refs/heads/")) {
                    gitBranch = gitBranch.substring(11);
                }
                branch = gitBranch;
            }
            
            if (gitCommit != null && !gitCommit.isEmpty()) {
                commitHash = gitCommit;
            }
            
        } catch (Exception e) {
            LOGGER.warning("Error extracting from environment: " + e.getMessage());
        }
    }
    
    /**
     * Extract Git info from SCM configuration
     */
    private void extractFromSCM() {
        try {
            if (run.getParent() instanceof hudson.model.AbstractProject) {
                hudson.model.AbstractProject<?, ?> project = (hudson.model.AbstractProject<?, ?>) run.getParent();
                SCM scm = project.getScm();
                
                if (scm instanceof GitSCM) {
                    GitSCM gitSCM = (GitSCM) scm;
                    
                    // Get branch information
                    if (!gitSCM.getBranches().isEmpty()) {
                        String branchSpec = gitSCM.getBranches().get(0).getName();
                        
                        // Clean up branch spec
                        if (branchSpec.startsWith("*/")) {
                            branchSpec = branchSpec.substring(2);
                        }
                        if (branchSpec.startsWith("origin/")) {
                            branchSpec = branchSpec.substring(7);
                        }
                        
                        if (branch == null || branch.isEmpty()) {
                            branch = branchSpec;
                        }
                    }
                }
            }
        } catch (Exception e) {
            LOGGER.warning("Error extracting from SCM: " + e.getMessage());
        }
    }
    
    /**
     * Set default values when Git info cannot be extracted
     */
    private void setDefaults() {
        if (branch == null || branch.isEmpty()) {
            branch = "main";
        }
        if (commitHash == null || commitHash.isEmpty()) {
            commitHash = "unknown";
        }
    }
    
    /**
     * Get the extracted branch name
     */
    public String getBranch() {
        return branch;
    }
    
    /**
     * Get the extracted commit hash
     */
    public String getCommitHash() {
        return commitHash;
    }
    
    /**
     * Get repository URL if available
     */
    public String getRepositoryUrl() {
        try {
            if (run.getParent() instanceof hudson.model.AbstractProject) {
                hudson.model.AbstractProject<?, ?> project = (hudson.model.AbstractProject<?, ?>) run.getParent();
                SCM scm = project.getScm();
                
                if (scm instanceof GitSCM) {
                    GitSCM gitSCM = (GitSCM) scm;
                    if (!gitSCM.getRepositories().isEmpty()) {
                        return gitSCM.getRepositories().get(0).getURIs().get(0).toString();
                    }
                }
            }
        } catch (Exception e) {
            LOGGER.warning("Error extracting repository URL: " + e.getMessage());
        }
        
        return null;
    }
    
    /**
     * Check if Git information is available
     */
    public boolean hasGitInfo() {
        return branch != null && !branch.equals("main") && 
               commitHash != null && !commitHash.equals("unknown");
    }
}