package dev.nixbit.sample;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.mockito.MockedStatic;
import org.mockito.Mockito;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Test suite for DataProcessor with various flaky test scenarios
 */
class DataProcessorTest {
    
    private DataProcessor processor;
    private Random random;
    
    @BeforeEach
    void setUp() {
        processor = new DataProcessor();
        random = new Random();
    }
    
    // ============ STABLE TESTS ============
    
    @Test
    void testProcessNumbers_ShouldDoubleAllNumbers() {
        // Stable test - always passes
        List<Integer> input = Arrays.asList(1, 2, 3, 4, 5);
        List<Integer> result = processor.processNumbers(input);
        
        assertThat(result).containsExactly(2, 4, 6, 8, 10);
    }
    
    @Test
    void testProcessNumbers_EmptyList() {
        // Stable test - always passes
        List<Integer> input = Collections.emptyList();
        List<Integer> result = processor.processNumbers(input);
        
        assertThat(result).isEmpty();
    }
    
    @Test
    void testParseJson_ValidJson() throws IOException {
        // Stable test - always passes
        String json = "{\"name\":\"test\",\"value\":123}";
        Map<String, Object> result = processor.parseJson(json);
        
        assertThat(result)
            .containsEntry("name", "test")
            .containsEntry("value", 123);
    }
    
    @Test
    void testParseJson_InvalidJson() {
        // Stable test - always passes
        String invalidJson = "{invalid json}";
        
        assertThatThrownBy(() -> processor.parseJson(invalidJson))
            .isInstanceOf(IOException.class);
    }
    
    // ============ FLAKY TESTS - ASYNC OPERATIONS ============
    
    @Test
    @Timeout(value = 500, unit = TimeUnit.MILLISECONDS)
    @EnabledIfSystemProperty(named = "test.flaky.enabled", matches = "true")
    void testFetchDataAsync_FlakyTimeout() throws Exception {
        // Flaky test - may timeout due to variable async delays
        // Success rate: ~75% (due to simulated network delays)
        
        CompletableFuture<List<String>> future = processor.fetchDataAsync("test-source");
        List<String> result = future.get(400, TimeUnit.MILLISECONDS);
        
        // Might timeout due to network simulation delays
        assertThat(result).isNotNull();
    }
    
    @Test
    @EnabledIfSystemProperty(named = "test.flaky.enabled", matches = "true")
    void testFetchDataWithTimeout_FlakyDueToRandomTimeout() {
        // Flaky test - sometimes times out due to simulated network issues
        // Success rate: ~60% (higher chance of timeout)
        
        try {
            List<String> result = processor.fetchDataWithTimeout("flaky-source", 100);
            assertThat(result).isNotNull();
        } catch (TimeoutException e) {
            // This is expected occasionally - flaky behavior
            fail("Timeout occurred - flaky network simulation");
        } catch (ExecutionException | InterruptedException e) {
            fail("Unexpected exception: " + e.getMessage());
        }
    }
    
    @RepeatedTest(3)
    @EnabledIfSystemProperty(named = "test.flaky.enabled", matches = "true")
    void testFetchDataAsync_FlakyEmptyResponse() throws Exception {
        // Flaky test - sometimes gets empty response (10% chance)
        // Success rate: ~90% per run, varies across repeated executions
        
        CompletableFuture<List<String>> future = processor.fetchDataAsync("empty-prone-source");
        List<String> result = future.get(1, TimeUnit.SECONDS);
        
        // This assertion will fail ~10% of the time due to empty responses
        assertThat(result)
            .as("Should not receive empty response")
            .isNotEmpty();
    }
    
    // ============ FLAKY TESTS - RESOURCE CONTENTION ============
    
    @Test
    @Timeout(value = 2, unit = TimeUnit.SECONDS)
    @EnabledIfSystemProperty(named = "test.flaky.enabled", matches = "true")
    void testProcessBatch_FlakyResourceContention() {
        // Flaky test - may slow down due to simulated resource contention
        // Success rate: ~85% (resource contention simulation)
        
        List<String> items = new ArrayList<>();
        for (int i = 0; i < 50; i++) {
            items.add("item-" + i);
        }
        
        List<DataProcessor.ProcessingResult> results = processor.processBatch(items, 10);
        
        // Might timeout due to resource contention simulation
        assertThat(results).hasSize(50);
        
        long successCount = results.stream()
            .mapToLong(r -> r.isSuccess() ? 1 : 0)
            .sum();
        
        // Should have most successes, but some might fail due to simulated errors
        assertThat(successCount).isGreaterThan(40);
    }
    
    @Test
    @EnabledIfSystemProperty(named = "test.flaky.enabled", matches = "true")
    void testGenerateLargeDataSet_FlakyMemoryPressure() {
        // Flaky test - may fail under memory pressure
        // Success rate: ~90% (depends on available memory)
        
        try {
            List<byte[]> dataSet = processor.generateLargeDataSet(100, 1024);
            
            assertThat(dataSet).hasSize(100);
            assertThat(dataSet.get(0)).hasSize(1024);
            
            // This might fail due to simulated memory pressure
            assertThat(dataSet.stream().allMatch(Objects::nonNull))
                .as("All data blocks should be non-null")
                .isTrue();
                
        } catch (OutOfMemoryError e) {
            // Simulate occasional memory issues
            fail("Out of memory during data generation - flaky memory pressure");
        }
    }
    
    // ============ FLAKY TESTS - PROCESSING ERRORS ============
    
    @Test
    @EnabledIfSystemProperty(named = "test.flaky.enabled", matches = "true")
    void testProcessNumbers_FlakyProcessingFailures() {
        // Flaky test - some numbers might fail processing (2% failure rate)
        // Success rate: varies based on random failures
        
        List<Integer> input = new ArrayList<>();
        for (int i = 1; i <= 100; i++) {
            input.add(i);
        }
        
        List<Integer> result = processor.processNumbers(input);
        
        // This assertion might fail if too many processing failures occur
        assertThat(result.size())
            .as("Should process most numbers successfully")
            .isGreaterThan(95); // Expect at least 95% success rate
    }
    
    @RepeatedTest(5)
    @EnabledIfSystemProperty(named = "test.flaky.enabled", matches = "true")
    void testParseJson_FlakyDueToRandomDelays() throws IOException {
        // Flaky test - parsing might be slow due to random delays
        // Success rate: ~85% (timeout due to processing delays)
        
        String complexJson = """
            {
                "users": [
                    {"id": 1, "name": "John", "active": true},
                    {"id": 2, "name": "Jane", "active": false},
                    {"id": 3, "name": "Bob", "active": true}
                ],
                "metadata": {
                    "total": 3,
                    "timestamp": "2023-01-01T00:00:00Z"
                }
            }
            """;
        
        long startTime = System.currentTimeMillis();
        Map<String, Object> result = processor.parseJson(complexJson);
        long parseTime = System.currentTimeMillis() - startTime;
        
        assertThat(result).isNotNull();
        
        // This might fail if parsing is too slow due to random delays
        assertThat(parseTime)
            .as("Parsing should be reasonably fast")
            .isLessThan(100); // 100ms threshold
    }
    
    // ============ FLAKY TESTS - CONCURRENCY ISSUES ============
    
    @Test
    @EnabledIfSystemProperty(named = "test.flaky.enabled", matches = "true")
    void testConcurrentProcessing_FlakyRaceCondition() throws InterruptedException {
        // Flaky test - race conditions in concurrent processing
        // Success rate: ~70% (race condition dependent)
        
        List<CompletableFuture<List<String>>> futures = new ArrayList<>();
        
        // Start multiple async operations concurrently
        for (int i = 0; i < 5; i++) {
            futures.add(processor.fetchDataAsync("concurrent-source-" + i));
        }
        
        // Wait for all to complete with a tight timeout
        List<List<String>> results = new ArrayList<>();
        for (CompletableFuture<List<String>> future : futures) {
            try {
                results.add(future.get(200, TimeUnit.MILLISECONDS));
            } catch (ExecutionException | TimeoutException e) {
                // This might happen due to resource contention
                fail("Concurrent operation failed: " + e.getMessage());
            }
        }
        
        // Verify all operations completed
        assertThat(results).hasSize(5);
        assertThat(results.stream().allMatch(Objects::nonNull)).isTrue();
    }
    
    @Test
    @EnabledIfSystemProperty(named = "test.flaky.enabled", matches = "true")
    void testProcessingUnderLoad_FlakySystemDependency() {
        // Flaky test - behavior changes under system load
        // Success rate: varies based on system performance
        
        // Create some system load
        List<Thread> loadThreads = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            Thread loadThread = new Thread(() -> {
                for (int j = 0; j < 1000; j++) {
                    // Simulate CPU-intensive work
                    Math.sqrt(Math.random() * 1000000);
                }
            });
            loadThreads.add(loadThread);
            loadThread.start();
        }
        
        try {
            // Perform processing under load
            List<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
            long startTime = System.currentTimeMillis();
            List<Integer> result = processor.processNumbers(numbers);
            long processingTime = System.currentTimeMillis() - startTime;
            
            assertThat(result).hasSize(10);
            
            // This might fail if system is under too much load
            assertThat(processingTime)
                .as("Processing should complete within reasonable time even under load")
                .isLessThan(500);
                
        } finally {
            // Clean up load threads
            for (Thread thread : loadThreads) {
                thread.interrupt();
            }
        }
    }
    
    // ============ FLAKY TESTS - ENVIRONMENT DEPENDENT ============
    
    @Test
    @EnabledIfSystemProperty(named = "test.flaky.enabled", matches = "true")
    void testEnvironmentDependent_FlakyConfiguration() {
        // Flaky test - depends on environment configuration
        // Success rate: varies by environment
        
        String testConfig = System.getProperty("test.environment.config", "default");
        
        // Different behavior based on environment
        switch (testConfig) {
            case "production":
                // Stricter requirements in production-like environment
                assertThat(processor.processNumbers(Arrays.asList(1, 2, 3)))
                    .hasSize(3);
                break;
            case "staging":
                // More lenient in staging
                List<Integer> result = processor.processNumbers(Arrays.asList(1, 2, 3, 4, 5));
                assertThat(result.size()).isBetween(3, 5);
                break;
            default:
                // Default behavior - might be inconsistent
                if (random.nextBoolean()) {
                    assertThat(true).isTrue(); // Sometimes passes
                } else {
                    fail("Random environment-based failure");
                }
        }
    }
    
    @Test
    @EnabledIfSystemProperty(named = "test.flaky.enabled", matches = "true") 
    void testRandomSystemBehavior_HighlyFlaky() {
        // Intentionally highly flaky test for testing detection algorithms
        // Success rate: ~25% (very flaky for clear detection)
        
        double flakyFactor = Double.parseDouble(
            System.getProperty("test.flaky.factor", "0.3"));
        
        // Multiple random failure points
        if (random.nextDouble() < flakyFactor) {
            throw new RuntimeException("Random failure point 1");
        }
        
        // Some processing
        List<Integer> numbers = Arrays.asList(1, 2, 3);
        List<Integer> result = processor.processNumbers(numbers);
        
        if (random.nextDouble() < flakyFactor) {
            assertThat(result).hasSize(10); // Wrong assertion - will fail
        }
        
        if (random.nextDouble() < flakyFactor) {
            throw new IllegalStateException("Random failure point 2");
        }
        
        // If we get here, test passes
        assertThat(result).isNotNull();
    }
    
    // ============ INTEGRATION-STYLE FLAKY TESTS ============
    
    @Test
    @Timeout(value = 1, unit = TimeUnit.SECONDS)
    @EnabledIfSystemProperty(named = "test.flaky.enabled", matches = "true")
    void testFullWorkflow_FlakyIntegration() throws Exception {
        // Flaky integration test combining multiple operations
        // Success rate: ~55% (multiple failure points)
        
        // Step 1: Fetch data (may timeout)
        List<String> fetchedData = processor.fetchDataWithTimeout("integration-test", 300);
        assertThat(fetchedData).isNotEmpty();
        
        // Step 2: Process batch (may have resource contention)
        List<DataProcessor.ProcessingResult> batchResults = 
            processor.processBatch(fetchedData, 5);
        
        long successCount = batchResults.stream()
            .mapToLong(r -> r.isSuccess() ? 1 : 0)
            .sum();
        
        assertThat(successCount).isGreaterThan(0);
        
        // Step 3: Parse some JSON (may be slow)
        String testJson = "{\"results\": " + successCount + "}";
        Map<String, Object> parsed = processor.parseJson(testJson);
        
        assertThat(parsed).containsKey("results");
        
        // Final assertion that might fail due to timing
        long totalTime = System.currentTimeMillis() % 1000;
        assertThat(totalTime)
            .as("Integration test timing check")
            .isLessThan(800); // Might fail based on when test runs
    }
}