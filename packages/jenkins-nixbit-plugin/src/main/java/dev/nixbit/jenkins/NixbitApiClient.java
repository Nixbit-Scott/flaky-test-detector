package dev.nixbit.jenkins;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.CloseableHttpResponse;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.io.entity.StringEntity;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import java.util.logging.Logger;

/**
 * HTTP client for communicating with Nixbit API
 */
public class NixbitApiClient {
    
    private static final Logger LOGGER = Logger.getLogger(NixbitApiClient.class.getName());
    private static final int TIMEOUT_SECONDS = 30;
    private static final int MAX_RETRIES = 3;
    
    private final String apiUrl;
    private final String apiKey;
    private final boolean debugMode;
    private final ObjectMapper objectMapper;
    private final CloseableHttpClient httpClient;
    
    public NixbitApiClient(String apiUrl, String apiKey, boolean debugMode) {
        this.apiUrl = apiUrl.endsWith("/") ? apiUrl.substring(0, apiUrl.length() - 1) : apiUrl;
        this.apiKey = apiKey;
        this.debugMode = debugMode;
        this.objectMapper = new ObjectMapper();
        
        this.httpClient = HttpClients.custom()
            .setConnectionTimeToLive(TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .build();
    }
    
    /**
     * Test connection to Nixbit API
     */
    public boolean testConnection() {
        try {
            HttpGet request = new HttpGet(apiUrl + "/health");
            request.setHeader("Authorization", "Bearer " + apiKey);
            request.setHeader("User-Agent", "Jenkins-Nixbit-Plugin/1.0.0");
            
            try (CloseableHttpResponse response = httpClient.execute(request)) {
                int statusCode = response.getCode();
                
                if (debugMode) {
                    LOGGER.info("Health check response: " + statusCode);
                }
                
                return statusCode >= 200 && statusCode < 300;
            }
            
        } catch (Exception e) {
            if (debugMode) {
                LOGGER.severe("Health check failed: " + e.getMessage());
            }
            return false;
        }
    }
    
    /**
     * Submit test results to Nixbit API
     */
    public NixbitApiResponse submitTestResults(NixbitTestRun testRun) {
        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                if (debugMode) {
                    LOGGER.info("Submitting test results (attempt " + attempt + "/" + MAX_RETRIES + ")");
                }
                
                String jsonPayload = objectMapper.writeValueAsString(testRun);
                
                HttpPost request = new HttpPost(apiUrl + "/test-results");
                request.setHeader("Authorization", "Bearer " + apiKey);
                request.setHeader("Content-Type", ContentType.APPLICATION_JSON.getMimeType());
                request.setHeader("User-Agent", "Jenkins-Nixbit-Plugin/1.0.0");
                request.setEntity(new StringEntity(jsonPayload, StandardCharsets.UTF_8));
                
                try (CloseableHttpResponse response = httpClient.execute(request)) {
                    int statusCode = response.getCode();
                    HttpEntity entity = response.getEntity();
                    String responseBody = entity != null ? EntityUtils.toString(entity, StandardCharsets.UTF_8) : "";
                    
                    if (debugMode) {
                        LOGGER.info("API Response - Status: " + statusCode + ", Body: " + responseBody);
                    }
                    
                    if (statusCode >= 200 && statusCode < 300) {
                        // Success
                        NixbitApiResponse apiResponse = objectMapper.readValue(responseBody, NixbitApiResponse.class);
                        apiResponse.setStatusCode(statusCode);
                        return apiResponse;
                        
                    } else if (statusCode >= 400 && statusCode < 500) {
                        // Client error - don't retry
                        NixbitApiResponse errorResponse = new NixbitApiResponse();
                        errorResponse.setSuccess(false);
                        errorResponse.setStatusCode(statusCode);
                        errorResponse.setErrorMessage("Client error: " + responseBody);
                        return errorResponse;
                        
                    } else {
                        // Server error - retry
                        if (attempt == MAX_RETRIES) {
                            NixbitApiResponse errorResponse = new NixbitApiResponse();
                            errorResponse.setSuccess(false);
                            errorResponse.setStatusCode(statusCode);
                            errorResponse.setErrorMessage("Server error after " + MAX_RETRIES + " attempts: " + responseBody);
                            return errorResponse;
                        }
                        
                        // Wait before retry
                        Thread.sleep(1000 * attempt);
                    }
                }
                
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                NixbitApiResponse errorResponse = new NixbitApiResponse();
                errorResponse.setSuccess(false);
                errorResponse.setErrorMessage("Request interrupted: " + e.getMessage());
                return errorResponse;
                
            } catch (Exception e) {
                if (attempt == MAX_RETRIES) {
                    LOGGER.severe("Failed to submit test results after " + MAX_RETRIES + " attempts: " + e.getMessage());
                    
                    NixbitApiResponse errorResponse = new NixbitApiResponse();
                    errorResponse.setSuccess(false);
                    errorResponse.setErrorMessage("Request failed: " + e.getMessage());
                    return errorResponse;
                }
                
                if (debugMode) {
                    LOGGER.warning("Attempt " + attempt + " failed, retrying: " + e.getMessage());
                }
                
                try {
                    Thread.sleep(1000 * attempt);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        
        NixbitApiResponse errorResponse = new NixbitApiResponse();
        errorResponse.setSuccess(false);
        errorResponse.setErrorMessage("All retry attempts failed");
        return errorResponse;
    }
    
    /**
     * Get retry recommendations for failed tests
     */
    public NixbitRetryRecommendation getRetryRecommendations(String projectId, String buildId) {
        try {
            String url = String.format("%s/projects/%s/retry-recommendations?buildId=%s", 
                apiUrl, projectId, buildId);
            
            HttpGet request = new HttpGet(url);
            request.setHeader("Authorization", "Bearer " + apiKey);
            request.setHeader("User-Agent", "Jenkins-Nixbit-Plugin/1.0.0");
            
            try (CloseableHttpResponse response = httpClient.execute(request)) {
                int statusCode = response.getCode();
                HttpEntity entity = response.getEntity();
                String responseBody = entity != null ? EntityUtils.toString(entity, StandardCharsets.UTF_8) : "";
                
                if (statusCode >= 200 && statusCode < 300) {
                    return objectMapper.readValue(responseBody, NixbitRetryRecommendation.class);
                } else {
                    LOGGER.warning("Failed to get retry recommendations: " + statusCode + " - " + responseBody);
                    return new NixbitRetryRecommendation();
                }
            }
            
        } catch (Exception e) {
            LOGGER.severe("Error getting retry recommendations: " + e.getMessage());
            return new NixbitRetryRecommendation();
        }
    }
    
    /**
     * Close the HTTP client
     */
    public void close() {
        try {
            httpClient.close();
        } catch (IOException e) {
            LOGGER.warning("Error closing HTTP client: " + e.getMessage());
        }
    }
}