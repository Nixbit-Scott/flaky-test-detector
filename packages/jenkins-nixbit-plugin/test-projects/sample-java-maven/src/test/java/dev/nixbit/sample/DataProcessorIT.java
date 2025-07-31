package dev.nixbit.sample;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;

/**
 * Integration tests for DataProcessor with flaky behavior patterns
 * These tests simulate real-world integration scenarios that often exhibit flakiness
 */
class DataProcessorIT {
    
    private DataProcessor processor;
    private Random random;
    
    @BeforeEach
    void setUp() {
        processor = new DataProcessor();
        random = new Random();
        
        // Simulate integration test setup delays
        try {
            Thread.sleep(random.nextInt(50) + 10);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
    
    // ============ INTEGRATION TESTS - DATABASE SIMULATION ============
    
    @Test
    @Timeout(value = 5, unit = TimeUnit.SECONDS)
    void testDatabaseIntegration_FlakyConnection() throws Exception {
        // Simulates flaky database connections
        // Success rate: ~80% (connection timeouts)
        
        // Simulate database connection delay
        simulateDatabaseConnection();
        
        // Fetch data that depends on "database"
        CompletableFuture<List<String>> future = processor.fetchDataAsync("database-source");
        List<String> data = future.get(3, TimeUnit.SECONDS);
        
        assertThat(data).isNotNull();
        assertThat(data.size()).isGreaterThan(0);
        
        // Simulate database transaction
        List<DataProcessor.ProcessingResult> results = processor.processBatch(data, 5);
        
        // Check that most operations succeeded
        long successCount = results.stream().mapToLong(r -> r.isSuccess() ? 1 : 0).sum();
        assertThat(successCount).isGreaterThan(data.size() * 0.8); // 80% success rate
    }
    
    @RepeatedTest(3)
    @Timeout(value = 3, unit = TimeUnit.SECONDS)
    void testDatabaseTransactionRollback_FlakyCleanup() {
        // Simulates flaky database transaction rollbacks
        // Success rate: ~70% (transaction conflicts)
        
        List<String> transactionData = Arrays.asList(
            "insert-user-1", "insert-user-2", "insert-user-3",
            "update-user-1", "delete-user-2"
        );
        
        try {
            // Simulate transaction start
            simulateTransactionStart();
            
            // Process transaction data
            List<DataProcessor.ProcessingResult> results = processor.processBatch(transactionData, 2);
            
            // Check for transaction conflicts (simulated failures)
            boolean hasConflicts = results.stream().anyMatch(r -> !r.isSuccess());
            
            if (hasConflicts && random.nextDouble() < 0.3) {
                // Simulate rollback failure
                throw new RuntimeException("Transaction rollback failed - database inconsistency");
            }
            
            // Verify final state
            assertThat(results).hasSize(5);
            
        } catch (Exception e) {
            // Flaky cleanup - sometimes fails
            if (random.nextBoolean()) {
                throw new AssertionError("Failed to clean up transaction: " + e.getMessage());
            }
        }
    }
    
    // ============ INTEGRATION TESTS - MICROSERVICE COMMUNICATION ============
    
    @Test
    @Timeout(value = 4, unit = TimeUnit.SECONDS)
    void testMicroserviceChain_FlakyServiceDependencies() throws Exception {
        // Simulates flaky microservice chain calls
        // Success rate: ~65% (cascading failures)
        
        // Service A call
        CompletableFuture<List<String>> serviceAResult = processor.fetchDataAsync("service-a");
        List<String> dataFromA = serviceAResult.get(1, TimeUnit.SECONDS);
        
        // Service B call (depends on A)
        List<String> enrichedData = new ArrayList<>();
        for (String item : dataFromA) {
            // Simulate service B enrichment with potential failures
            if (random.nextDouble() < 0.1) { // 10% failure rate
                throw new RuntimeException("Service B unavailable for item: " + item);
            }
            enrichedData.add("enriched-" + item);
        }
        
        // Service C call (final processing)
        List<DataProcessor.ProcessingResult> finalResults = processor.processBatch(enrichedData, 3);
        
        // Verify the chain succeeded
        assertThat(finalResults).isNotEmpty();
        
        // This might fail if too many service calls failed
        long successCount = finalResults.stream().mapToLong(r -> r.isSuccess() ? 1 : 0).sum();
        assertThat(successCount).isGreaterThan(enrichedData.size() * 0.7);
    }
    
    @Test
    void testCircuitBreakerPattern_FlakyRecovery() throws Exception {
        // Simulates circuit breaker behavior with flaky recovery
        // Success rate: ~75% (circuit breaker state dependent)
        
        int failureCount = 0;
        int maxFailures = 3;
        
        for (int attempt = 0; attempt < 5; attempt++) {
            try {
                // Simulate service call
                CompletableFuture<List<String>> future = processor.fetchDataAsync("flaky-service");
                List<String> result = future.get(500, TimeUnit.MILLISECONDS);
                
                // Success - reset failure count
                failureCount = 0;
                assertThat(result).isNotNull();
                break;
                
            } catch (Exception e) {
                failureCount++;
                
                if (failureCount >= maxFailures) {
                    // Circuit breaker opens
                    throw new RuntimeException("Circuit breaker opened after " + failureCount + " failures");
                }
                
                // Wait before retry (flaky - sometimes too short)
                Thread.sleep(random.nextInt(100) + 50);
            }
        }
        
        // Should have succeeded within 5 attempts
        assertThat(failureCount).isLessThan(maxFailures);
    }
    
    // ============ INTEGRATION TESTS - FILE SYSTEM OPERATIONS ============
    
    @Test
    void testFileSystemOperations_FlakyIOOperations() {
        // Simulates flaky file system operations
        // Success rate: ~85% (I/O timeouts and permissions)
        
        // Simulate file creation with potential I/O delays
        simulateFileOperation("create");
        
        // Generate data to "write"
        List<byte[]> dataToWrite = processor.generateLargeDataSet(10, 512);
        assertThat(dataToWrite).hasSize(10);
        
        // Simulate file writing with potential failures
        for (int i = 0; i < dataToWrite.size(); i++) {
            if (random.nextDouble() < 0.05) { // 5% I/O failure rate
                throw new RuntimeException("I/O error writing block " + i);
            }
            
            // Simulate write delay
            try {
                Thread.sleep(random.nextInt(20) + 5);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("Write operation interrupted");
            }
        }
        
        // Simulate file cleanup (sometimes fails)
        simulateFileOperation("delete");
    }
    
    @Test
    @Timeout(value = 2, unit = TimeUnit.SECONDS)
    void testConcurrentFileAccess_FlakyLocking() throws InterruptedException {
        // Simulates flaky file locking in concurrent scenarios
        // Success rate: ~70% (lock contention)
        
        List<Thread> fileAccessThreads = new ArrayList<>();
        List<Exception> exceptions = Collections.synchronizedList(new ArrayList<>());
        
        for (int i = 0; i < 3; i++) {
            final int threadId = i;
            Thread thread = new Thread(() -> {
                try {
                    // Simulate file lock acquisition
                    simulateFileLock("file-" + threadId);
                    
                    // Simulate file processing
                    List<String> fileData = Arrays.asList("line1", "line2", "line3");
                    processor.processBatch(fileData, 1);
                    
                    // Simulate file unlock
                    simulateFileUnlock("file-" + threadId);
                    
                } catch (Exception e) {
                    exceptions.add(e);
                }
            });
            
            fileAccessThreads.add(thread);
            thread.start();
        }
        
        // Wait for all threads
        for (Thread thread : fileAccessThreads) {
            thread.join(500); // Short timeout - might not complete
        }
        
        // This might fail if too many lock contentions occurred
        assertThat(exceptions.size())
            .as("Should have minimal file access conflicts")
            .isLessThan(2);
    }
    
    // ============ INTEGRATION TESTS - NETWORK OPERATIONS ============
    
    @Test
    @Timeout(value = 3, unit = TimeUnit.SECONDS)
    void testNetworkTimeouts_FlakyConnectivity() throws Exception {
        // Simulates flaky network connectivity
        // Success rate: ~60% (network timeouts)
        
        List<CompletableFuture<List<String>>> networkCalls = new ArrayList<>();
        
        // Simulate multiple network endpoints
        String[] endpoints = {"api-1", "api-2", "api-3", "cdn-service"};
        
        for (String endpoint : endpoints) {
            networkCalls.add(processor.fetchDataAsync(endpoint));
        }
        
        // Wait for all network calls with aggressive timeout
        List<List<String>> results = new ArrayList<>();
        for (CompletableFuture<List<String>> call : networkCalls) {
            try {
                results.add(call.get(600, TimeUnit.MILLISECONDS));
            } catch (Exception e) {
                // Network timeout - might happen frequently
                if (random.nextDouble() < 0.4) { // 40% chance to fail the test
                    throw new AssertionError("Network timeout for critical service: " + e.getMessage());
                }
                // Otherwise, continue with degraded functionality
                results.add(Collections.emptyList());
            }
        }
        
        // Should have at least some successful network calls
        long successfulCalls = results.stream().mapToLong(r -> r.isEmpty() ? 0 : 1).sum();
        assertThat(successfulCalls).isGreaterThan(1);
    }
    
    @RepeatedTest(2)
    void testRetryLogic_FlakyBackoffStrategy() throws Exception {
        // Simulates flaky retry logic with exponential backoff
        // Success rate: ~80% (backoff timing issues)
        
        int maxRetries = 3;
        int attempt = 0;
        Exception lastException = null;
        
        while (attempt < maxRetries) {
            try {
                // Simulate operation that fails initially then succeeds
                if (attempt < 2 && random.nextDouble() < 0.7) {
                    throw new RuntimeException("Temporary failure on attempt " + (attempt + 1));
                }
                
                // Success on retry
                List<String> result = processor.fetchDataAsync("retry-service")
                    .get(1, TimeUnit.SECONDS);
                assertThat(result).isNotNull();
                return; // Success
                
            } catch (Exception e) {
                lastException = e;
                attempt++;
                
                // Exponential backoff (flaky - timing sensitive)
                long backoffTime = (long) Math.pow(2, attempt) * 100;
                
                // Sometimes backoff is too short (flaky timing)
                if (random.nextBoolean()) {
                    backoffTime = backoffTime / 2;
                }
                
                Thread.sleep(backoffTime);
            }
        }
        
        // All retries failed
        throw new AssertionError("All retries failed. Last exception: " + lastException.getMessage());
    }
    
    // ============ INTEGRATION TESTS - EXTERNAL DEPENDENCIES ============
    
    @Test
    void testExternalAPIIntegration_FlakyThirdPartyService() throws Exception {
        // Simulates integration with flaky third-party APIs
        // Success rate: ~70% (external service reliability)
        
        // Simulate authentication with external service
        boolean authSuccess = simulateExternalAuth();
        if (!authSuccess && random.nextDouble() < 0.3) {
            throw new RuntimeException("External service authentication failed");
        }
        
        // Simulate API calls with rate limiting
        List<String> apiResponses = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            try {
                // Simulate rate limiting (flaky)
                if (random.nextDouble() < 0.15) { // 15% rate limit hit
                    Thread.sleep(random.nextInt(200) + 100);
                    throw new RuntimeException("Rate limit exceeded");
                }
                
                CompletableFuture<List<String>> apiCall = processor.fetchDataAsync("external-api-" + i);
                List<String> response = apiCall.get(800, TimeUnit.MILLISECONDS);
                apiResponses.addAll(response);
                
            } catch (Exception e) {
                // Some API failures are acceptable
                if (random.nextDouble() < 0.2) { // 20% chance to fail test
                    throw new AssertionError("Critical external API failure: " + e.getMessage());
                }
            }
        }
        
        // Should have some successful API responses
        assertThat(apiResponses.size()).isGreaterThan(0);
    }
    
    // ============ HELPER METHODS FOR SIMULATION ============
    
    private void simulateDatabaseConnection() {
        // Simulate database connection with variable latency
        try {
            long connectionTime = random.nextInt(200) + 50;
            
            // 15% chance of connection timeout
            if (random.nextDouble() < 0.15) {
                connectionTime += random.nextInt(500) + 300;
            }
            
            Thread.sleep(connectionTime);
            
            // 5% chance of connection failure
            if (random.nextDouble() < 0.05) {
                throw new RuntimeException("Database connection failed");
            }
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Connection interrupted");
        }
    }
    
    private void simulateTransactionStart() {
        try {
            // Transaction setup delay
            Thread.sleep(random.nextInt(30) + 10);
            
            // 10% chance of transaction start failure
            if (random.nextDouble() < 0.1) {
                throw new RuntimeException("Failed to start transaction");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
    
    private void simulateFileOperation(String operation) {
        try {
            // File operation delay
            Thread.sleep(random.nextInt(50) + 20);
            
            // 8% chance of file operation failure
            if (random.nextDouble() < 0.08) {
                throw new RuntimeException("File " + operation + " operation failed");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
    
    private void simulateFileLock(String fileName) {
        try {
            // Lock acquisition delay (contention simulation)
            Thread.sleep(random.nextInt(100) + 25);
            
            // 12% chance of lock acquisition failure
            if (random.nextDouble() < 0.12) {
                throw new RuntimeException("Failed to acquire lock for " + fileName);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
    
    private void simulateFileUnlock(String fileName) {
        try {
            Thread.sleep(random.nextInt(20) + 5);
            
            // 3% chance of unlock failure
            if (random.nextDouble() < 0.03) {
                throw new RuntimeException("Failed to release lock for " + fileName);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
    
    private boolean simulateExternalAuth() {
        try {
            // Auth delay
            Thread.sleep(random.nextInt(150) + 75);
            
            // 20% chance of auth failure
            return random.nextDouble() >= 0.2;
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
}