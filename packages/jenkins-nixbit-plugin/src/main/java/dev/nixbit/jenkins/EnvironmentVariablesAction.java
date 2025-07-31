package dev.nixbit.jenkins;

import hudson.EnvVars;
import hudson.model.EnvironmentContributingAction;
import hudson.model.AbstractBuild;

import java.util.HashMap;
import java.util.Map;

/**
 * Action to add environment variables to Jenkins builds for retry logic
 */
public class EnvironmentVariablesAction implements EnvironmentContributingAction {
    
    private final Map<String, String> variables;
    
    /**
     * Constructor with variable arguments
     */
    public EnvironmentVariablesAction(String... keyValuePairs) {
        this.variables = new HashMap<>();
        
        if (keyValuePairs.length % 2 != 0) {
            throw new IllegalArgumentException("Key-value pairs must be even number of arguments");
        }
        
        for (int i = 0; i < keyValuePairs.length; i += 2) {
            variables.put(keyValuePairs[i], keyValuePairs[i + 1]);
        }
    }
    
    /**
     * Constructor with map
     */
    public EnvironmentVariablesAction(Map<String, String> variables) {
        this.variables = new HashMap<>(variables);
    }
    
    @Override
    public void buildEnvVars(AbstractBuild<?, ?> build, EnvVars env) {
        env.putAll(variables);
    }
    
    @Override
    public String getIconFileName() {
        return null; // No icon in UI
    }
    
    @Override
    public String getDisplayName() {
        return null; // No display name
    }
    
    @Override
    public String getUrlName() {
        return null; // No URL
    }
    
    /**
     * Get the environment variables
     */
    public Map<String, String> getVariables() {
        return new HashMap<>(variables);
    }
    
    /**
     * Add a variable
     */
    public void addVariable(String key, String value) {
        variables.put(key, value);
    }
    
    /**
     * Get a specific variable
     */
    public String getVariable(String key) {
        return variables.get(key);
    }
    
    /**
     * Check if a variable exists
     */
    public boolean hasVariable(String key) {
        return variables.containsKey(key);
    }
}