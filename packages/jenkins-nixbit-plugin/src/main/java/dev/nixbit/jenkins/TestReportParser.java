package dev.nixbit.jenkins;

import hudson.FilePath;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.InputStream;
import java.io.PrintStream;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Logger;

/**
 * Parser for XML test report files (JUnit, TestNG, etc.)
 */
public class TestReportParser {
    
    private static final Logger LOGGER = Logger.getLogger(TestReportParser.class.getName());
    
    /**
     * Parse test reports from files matching the given pattern
     */
    public static List<NixbitTestResult> parseTestReports(FilePath workspace, String pattern, 
                                                         PrintStream logger, boolean debugMode) {
        List<NixbitTestResult> results = new ArrayList<>();
        
        try {
            if (debugMode) {
                logger.println("[Nixbit] Searching for test reports with pattern: " + pattern);
            }
            
            // Split pattern by comma for multiple patterns
            String[] patterns = pattern.split(",");
            
            for (String singlePattern : patterns) {
                results.addAll(parsePattern(workspace, singlePattern.trim(), logger, debugMode));
            }
            
            if (debugMode) {
                logger.println(String.format("[Nixbit] Found %d test results from file parsing", results.size()));
            }
            
        } catch (Exception e) {
            logger.println("[Nixbit] Error parsing test report files: " + e.getMessage());
            LOGGER.severe("Test report parsing error: " + e.getMessage());
            
            if (debugMode) {
                e.printStackTrace(logger);
            }
        }
        
        return results;
    }
    
    /**
     * Parse files matching a single pattern
     */
    private static List<NixbitTestResult> parsePattern(FilePath workspace, String pattern, 
                                                      PrintStream logger, boolean debugMode) {
        List<NixbitTestResult> results = new ArrayList<>();
        
        try {
            FilePath[] files = workspace.list(pattern);
            
            if (debugMode) {
                logger.println(String.format("[Nixbit] Found %d files matching pattern '%s'", 
                    files.length, pattern));
            }
            
            for (FilePath file : files) {
                if (debugMode) {
                    logger.println("[Nixbit] Parsing file: " + file.getRemote());
                }
                
                results.addAll(parseXmlFile(file, logger, debugMode));
            }
            
        } catch (Exception e) {
            logger.println("[Nixbit] Error processing pattern " + pattern + ": " + e.getMessage());
            
            if (debugMode) {
                e.printStackTrace(logger);
            }
        }
        
        return results;
    }
    
    /**
     * Parse a single XML test report file
     */
    private static List<NixbitTestResult> parseXmlFile(FilePath file, PrintStream logger, boolean debugMode) {
        List<NixbitTestResult> results = new ArrayList<>();
        
        try (InputStream inputStream = file.read()) {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            
            // Security settings
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document document = builder.parse(inputStream);
            
            // Normalize the document
            document.getDocumentElement().normalize();
            
            // Determine the format and parse accordingly
            Element rootElement = document.getDocumentElement();
            String rootTagName = rootElement.getTagName().toLowerCase();
            
            if (debugMode) {
                logger.println("[Nixbit] XML root element: " + rootTagName);
            }
            
            switch (rootTagName) {
                case "testsuite":
                case "testsuites":
                    results.addAll(parseJUnitFormat(document, logger, debugMode));
                    break;
                case "testng-results":
                    results.addAll(parseTestNGFormat(document, logger, debugMode));
                    break;
                default:
                    if (debugMode) {
                        logger.println("[Nixbit] Unknown XML format, attempting JUnit parsing");
                    }
                    results.addAll(parseJUnitFormat(document, logger, debugMode));
            }
            
        } catch (Exception e) {
            logger.println("[Nixbit] Error parsing XML file " + file.getRemote() + ": " + e.getMessage());
            
            if (debugMode) {
                e.printStackTrace(logger);
            }
        }
        
        return results;
    }
    
    /**
     * Parse JUnit XML format
     */
    private static List<NixbitTestResult> parseJUnitFormat(Document document, PrintStream logger, boolean debugMode) {
        List<NixbitTestResult> results = new ArrayList<>();
        
        try {
            // Handle both single testsuite and testsuites with multiple suites
            NodeList testSuites = document.getElementsByTagName("testsuite");
            
            if (debugMode) {
                logger.println("[Nixbit] Found " + testSuites.getLength() + " test suites in JUnit format");
            }
            
            for (int i = 0; i < testSuites.getLength(); i++) {
                Element testSuite = (Element) testSuites.item(i);
                results.addAll(parseJUnitTestSuite(testSuite, logger, debugMode));
            }
            
        } catch (Exception e) {
            logger.println("[Nixbit] Error parsing JUnit format: " + e.getMessage());
            
            if (debugMode) {
                e.printStackTrace(logger);
            }
        }
        
        return results;
    }
    
    /**
     * Parse a single JUnit test suite
     */
    private static List<NixbitTestResult> parseJUnitTestSuite(Element testSuite, PrintStream logger, boolean debugMode) {
        List<NixbitTestResult> results = new ArrayList<>();
        
        try {
            String suiteName = testSuite.getAttribute("name");
            
            NodeList testCases = testSuite.getElementsByTagName("testcase");
            
            if (debugMode) {
                logger.println(String.format("[Nixbit] Parsing suite '%s' with %d test cases", 
                    suiteName, testCases.getLength()));
            }
            
            for (int i = 0; i < testCases.getLength(); i++) {
                Element testCase = (Element) testCases.item(i);
                NixbitTestResult result = parseJUnitTestCase(testCase, suiteName, debugMode);
                if (result != null) {
                    results.add(result);
                }
            }
            
        } catch (Exception e) {
            logger.println("[Nixbit] Error parsing JUnit test suite: " + e.getMessage());
            
            if (debugMode) {
                e.printStackTrace(logger);
            }
        }
        
        return results;
    }
    
    /**
     * Parse a single JUnit test case
     */
    private static NixbitTestResult parseJUnitTestCase(Element testCase, String suiteName, boolean debugMode) {
        try {
            NixbitTestResult result = new NixbitTestResult();
            
            // Basic attributes
            String className = testCase.getAttribute("classname");
            String methodName = testCase.getAttribute("name");
            String timeStr = testCase.getAttribute("time");
            
            result.setName(className + "." + methodName);
            result.setSuite(suiteName);
            result.setClassName(className);
            result.setMethodName(methodName);
            
            // Duration
            if (!timeStr.isEmpty()) {
                try {
                    double timeSeconds = Double.parseDouble(timeStr);
                    result.setDuration(Math.round(timeSeconds * 1000));
                } catch (NumberFormatException e) {
                    result.setDuration(0);
                }
            }
            
            // Status determination
            NodeList failures = testCase.getElementsByTagName("failure");
            NodeList errors = testCase.getElementsByTagName("error");
            NodeList skipped = testCase.getElementsByTagName("skipped");
            
            if (failures.getLength() > 0) {
                result.setStatus("failed");
                Element failure = (Element) failures.item(0);
                result.setErrorMessage(failure.getAttribute("message"));
                result.setStackTrace(failure.getTextContent());
            } else if (errors.getLength() > 0) {
                result.setStatus("failed");
                Element error = (Element) errors.item(0);
                result.setErrorMessage(error.getAttribute("message"));
                result.setStackTrace(error.getTextContent());
            } else if (skipped.getLength() > 0) {
                result.setStatus("skipped");
            } else {
                result.setStatus("passed");
            }
            
            // File path
            if (className != null && !className.isEmpty()) {
                result.setFilePath(className.replace('.', '/') + ".java");
            }
            
            if (debugMode) {
                LOGGER.info(String.format("Parsed JUnit test: %s (%s) - %dms", 
                    result.getName(), result.getStatus(), result.getDuration()));
            }
            
            return result;
            
        } catch (Exception e) {
            LOGGER.severe("Error parsing JUnit test case: " + e.getMessage());
            return null;
        }
    }
    
    /**
     * Parse TestNG XML format
     */
    private static List<NixbitTestResult> parseTestNGFormat(Document document, PrintStream logger, boolean debugMode) {
        List<NixbitTestResult> results = new ArrayList<>();
        
        try {
            NodeList testMethods = document.getElementsByTagName("test-method");
            
            if (debugMode) {
                logger.println("[Nixbit] Found " + testMethods.getLength() + " test methods in TestNG format");
            }
            
            for (int i = 0; i < testMethods.getLength(); i++) {
                Element testMethod = (Element) testMethods.item(i);
                NixbitTestResult result = parseTestNGMethod(testMethod, debugMode);
                if (result != null) {
                    results.add(result);
                }
            }
            
        } catch (Exception e) {
            logger.println("[Nixbit] Error parsing TestNG format: " + e.getMessage());
            
            if (debugMode) {
                e.printStackTrace(logger);
            }
        }
        
        return results;
    }
    
    /**
     * Parse a single TestNG test method
     */
    private static NixbitTestResult parseTestNGMethod(Element testMethod, boolean debugMode) {
        try {
            NixbitTestResult result = new NixbitTestResult();
            
            // Basic attributes
            String className = testMethod.getAttribute("classname");
            String methodName = testMethod.getAttribute("name");
            String status = testMethod.getAttribute("status");
            String durationStr = testMethod.getAttribute("duration-ms");
            
            result.setName(className + "." + methodName);
            result.setSuite(extractSuiteFromClassName(className));
            result.setClassName(className);
            result.setMethodName(methodName);
            
            // Status mapping
            switch (status.toLowerCase()) {
                case "pass":
                    result.setStatus("passed");
                    break;
                case "fail":
                    result.setStatus("failed");
                    break;
                case "skip":
                    result.setStatus("skipped");
                    break;
                default:
                    result.setStatus("failed");
            }
            
            // Duration
            if (!durationStr.isEmpty()) {
                try {
                    result.setDuration(Long.parseLong(durationStr));
                } catch (NumberFormatException e) {
                    result.setDuration(0);
                }
            }
            
            // Error information
            if ("fail".equals(status.toLowerCase())) {
                NodeList exceptions = testMethod.getElementsByTagName("exception");
                if (exceptions.getLength() > 0) {
                    Element exception = (Element) exceptions.item(0);
                    result.setErrorMessage(exception.getAttribute("class"));
                    
                    NodeList messages = exception.getElementsByTagName("message");
                    if (messages.getLength() > 0) {
                        result.setStackTrace(messages.item(0).getTextContent());
                    }
                }
            }
            
            // File path
            if (className != null && !className.isEmpty()) {
                result.setFilePath(className.replace('.', '/') + ".java");
            }
            
            if (debugMode) {
                LOGGER.info(String.format("Parsed TestNG test: %s (%s) - %dms", 
                    result.getName(), result.getStatus(), result.getDuration()));
            }
            
            return result;
            
        } catch (Exception e) {
            LOGGER.severe("Error parsing TestNG method: " + e.getMessage());
            return null;
        }
    }
    
    /**
     * Extract suite name from class name
     */
    private static String extractSuiteFromClassName(String className) {
        if (className == null || className.isEmpty()) {
            return "default";
        }
        
        // Get the last part of the package name or class name
        String[] parts = className.split("\\.");
        if (parts.length > 1) {
            return parts[parts.length - 1];
        }
        
        return className;
    }
}