package dev.nixbit.jenkins;

import hudson.tasks.junit.CaseResult;
import hudson.tasks.junit.SuiteResult;
import hudson.tasks.junit.TestResult;

import java.io.PrintStream;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Logger;

/**
 * Parser for JUnit test results from Jenkins TestResult objects
 */
public class JUnitResultParser {
    
    private static final Logger LOGGER = Logger.getLogger(JUnitResultParser.class.getName());
    
    /**
     * Parse Jenkins TestResult into NixbitTestResult objects
     */
    public static List<NixbitTestResult> parseTestResult(TestResult testResult, PrintStream logger, boolean debugMode) {
        List<NixbitTestResult> results = new ArrayList<>();
        
        if (testResult == null) {
            if (debugMode) {
                logger.println("[Nixbit] No TestResult object found");
            }
            return results;
        }
        
        try {
            if (debugMode) {
                logger.println(String.format("[Nixbit] Parsing TestResult with %d suites", 
                    testResult.getSuites().size()));
            }
            
            for (SuiteResult suite : testResult.getSuites()) {
                results.addAll(parseSuiteResult(suite, logger, debugMode));
            }
            
            if (debugMode) {
                logger.println(String.format("[Nixbit] Parsed %d test results from JUnit", results.size()));
            }
            
        } catch (Exception e) {
            logger.println("[Nixbit] Error parsing JUnit test results: " + e.getMessage());
            LOGGER.severe("JUnit parsing error: " + e.getMessage());
            
            if (debugMode) {
                e.printStackTrace(logger);
            }
        }
        
        return results;
    }
    
    /**
     * Parse a single test suite
     */
    private static List<NixbitTestResult> parseSuiteResult(SuiteResult suite, PrintStream logger, boolean debugMode) {
        List<NixbitTestResult> results = new ArrayList<>();
        
        try {
            String suiteName = suite.getName();
            
            if (debugMode) {
                logger.println(String.format("[Nixbit] Parsing suite '%s' with %d cases", 
                    suiteName, suite.getCases().size()));
            }
            
            for (CaseResult caseResult : suite.getCases()) {
                NixbitTestResult nixbitResult = parseCaseResult(caseResult, suiteName, debugMode);
                if (nixbitResult != null) {
                    results.add(nixbitResult);
                }
            }
            
        } catch (Exception e) {
            logger.println("[Nixbit] Error parsing suite " + suite.getName() + ": " + e.getMessage());
            
            if (debugMode) {
                e.printStackTrace(logger);
            }
        }
        
        return results;
    }
    
    /**
     * Parse a single test case
     */
    private static NixbitTestResult parseCaseResult(CaseResult caseResult, String suiteName, boolean debugMode) {
        try {
            NixbitTestResult result = new NixbitTestResult();
            
            // Basic information
            result.setName(caseResult.getFullName());
            result.setSuite(suiteName);
            result.setClassName(caseResult.getClassName());
            result.setMethodName(caseResult.getName());
            
            // Status mapping
            if (caseResult.isPassed()) {
                result.setStatus("passed");
            } else if (caseResult.isSkipped()) {
                result.setStatus("skipped");
            } else {
                result.setStatus("failed");
            }
            
            // Duration (convert from seconds to milliseconds)
            result.setDuration(Math.round(caseResult.getDuration() * 1000));
            
            // Error information for failed tests
            if (!caseResult.isPassed() && !caseResult.isSkipped()) {
                String errorDetails = caseResult.getErrorDetails();
                String errorStackTrace = caseResult.getErrorStackTrace();
                
                result.setErrorMessage(errorDetails);
                result.setStackTrace(errorStackTrace);
            }
            
            // Extract file path if available (from class name)
            if (caseResult.getClassName() != null) {
                result.setFilePath(convertClassNameToFilePath(caseResult.getClassName()));
            }
            
            if (debugMode) {
                LOGGER.info(String.format("Parsed test case: %s (%s) - %s", 
                    result.getName(), result.getStatus(), result.getDuration() + "ms"));
            }
            
            return result;
            
        } catch (Exception e) {
            LOGGER.severe("Error parsing case result " + caseResult.getName() + ": " + e.getMessage());
            return null;
        }
    }
    
    /**
     * Convert Java class name to approximate file path
     */
    private static String convertClassNameToFilePath(String className) {
        if (className == null || className.isEmpty()) {
            return null;
        }
        
        // Convert package.ClassName to package/ClassName.java
        return className.replace('.', '/') + ".java";
    }
    
    /**
     * Extract retry count from test name or system properties if available
     */
    private static int extractRetryCount(CaseResult caseResult) {
        // Try to extract retry information from test name patterns
        String testName = caseResult.getName();
        
        // Common retry patterns in test names
        if (testName.contains("retry") || testName.contains("attempt")) {
            // This is a simplified approach - in reality, retry count would need to be
            // tracked through test framework specific mechanisms
            return 0;
        }
        
        return 0; // Default no retries
    }
}