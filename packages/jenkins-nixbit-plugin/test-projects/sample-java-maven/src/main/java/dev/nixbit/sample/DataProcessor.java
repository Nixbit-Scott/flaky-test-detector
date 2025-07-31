package dev.nixbit.sample;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Data processor with async operations that can exhibit flaky behavior
 */
public class DataProcessor {
    
    private static final Logger logger = LoggerFactory.getLogger(DataProcessor.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Random random = new Random();
    
    /**
     * Process a list of integers with potential async issues
     */
    public List<Integer> processNumbers(List<Integer> numbers) {
        logger.info("Processing {} numbers", numbers.size());
        
        return numbers.stream()
            .map(this::processNumber)
            .filter(Objects::nonNull)
            .sorted()
            .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
    }
    
    /**
     * Process individual number with potential flakiness
     */
    private Integer processNumber(Integer number) {
        // Simulate occasional processing failures
        if (random.nextDouble() < 0.02) { // 2% failure rate
            logger.warn("Processing failed for number: {}", number);
            return null;
        }
        
        // Simulate varying processing time
        simulateProcessingDelay();
        
        return number * 2;
    }
    
    /**
     * Async data fetching simulation with timeout issues
     */
    public CompletableFuture<List<String>> fetchDataAsync(String source) {
        logger.info("Fetching data from source: {}", source);
        
        return CompletableFuture.supplyAsync(() -> {
            // Simulate network call with variable latency
            simulateNetworkCall();
            
            // Simulate occasional empty responses
            if (random.nextDouble() < 0.1) { // 10% chance of empty response
                logger.warn("Empty response from source: {}", source);
                return Collections.emptyList();
            }
            
            // Generate sample data
            List<String> data = new ArrayList<>();
            int count = random.nextInt(10) + 1;
            
            for (int i = 0; i < count; i++) {
                data.add("data-" + source + "-" + i);
            }
            
            return data;
        });
    }
    
    /**
     * Synchronous data fetching with timeout
     */
    public List<String> fetchDataWithTimeout(String source, long timeoutMs) 
            throws TimeoutException, ExecutionException, InterruptedException {
        
        CompletableFuture<List<String>> future = fetchDataAsync(source);
        
        try {
            return future.get(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            logger.error("Timeout fetching data from source: {} (timeout: {}ms)", source, timeoutMs);
            future.cancel(true);
            throw e;
        }
    }
    
    /**
     * JSON processing with potential parsing issues
     */
    public Map<String, Object> parseJson(String json) throws IOException {
        logger.debug("Parsing JSON: {}", json.substring(0, Math.min(json.length(), 100)));
        
        // Simulate occasional parsing delays
        if (random.nextDouble() < 0.15) { // 15% chance of slow parsing
            simulateProcessingDelay();
        }
        
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> result = objectMapper.readValue(json, Map.class);
            return result;
        } catch (IOException e) {
            logger.error("Failed to parse JSON", e);
            throw e;
        }
    }
    
    /**
     * Batch processing with resource contention
     */
    public List<ProcessingResult> processBatch(List<String> items, int batchSize) {
        logger.info("Processing batch of {} items with batch size {}", items.size(), batchSize);
        
        List<ProcessingResult> results = new ArrayList<>();
        
        for (int i = 0; i < items.size(); i += batchSize) {
            int endIndex = Math.min(i + batchSize, items.size());
            List<String> batch = items.subList(i, endIndex);
            
            logger.debug("Processing batch {}-{}", i, endIndex - 1);
            
            // Simulate resource contention (flaky due to system load)
            if (random.nextDouble() < 0.08) { // 8% chance of resource contention
                logger.warn("Resource contention detected, retrying batch");
                simulateResourceContention();
            }
            
            for (String item : batch) {
                ProcessingResult result = processItem(item);
                results.add(result);
            }
        }
        
        return results;
    }
    
    /**
     * Process individual item
     */
    private ProcessingResult processItem(String item) {
        simulateProcessingDelay();
        
        // Simulate occasional processing errors
        if (random.nextDouble() < 0.03) { // 3% error rate
            return new ProcessingResult(item, false, "Processing error occurred");
        }
        
        return new ProcessingResult(item, true, "Processed successfully");
    }
    
    /**
     * Memory-intensive operation that might fail under load
     */
    public List<byte[]> generateLargeDataSet(int count, int size) {
        logger.info("Generating {} data blocks of {} bytes each", count, size);
        
        List<byte[]> dataSet = new ArrayList<>();
        
        for (int i = 0; i < count; i++) {
            // Simulate memory pressure (flaky under low memory conditions)
            if (random.nextDouble() < 0.05) { // 5% chance of memory pressure
                logger.warn("Memory pressure detected during data generation");
                System.gc(); // Suggest garbage collection
                simulateProcessingDelay();
            }
            
            byte[] data = new byte[size];
            random.nextBytes(data);
            dataSet.add(data);
        }
        
        return dataSet;
    }
    
    /**
     * Simulate variable processing delay
     */
    private void simulateProcessingDelay() {
        try {
            // Base delay 1-20ms
            long delay = random.nextInt(20) + 1;
            
            // Occasional longer delays (simulating system load)
            if (random.nextDouble() < 0.1) { // 10% chance
                delay += random.nextInt(100) + 50;
            }
            
            Thread.sleep(delay);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
    
    /**
     * Simulate network call with high variability
     */
    private void simulateNetworkCall() {
        try {
            // Base network delay 50-200ms
            long delay = random.nextInt(150) + 50;
            
            // Simulate network issues (high variability)
            if (random.nextDouble() < 0.15) { // 15% chance of network issues
                delay += random.nextInt(500) + 200;
                logger.debug("Simulating network latency: {}ms", delay);
            }
            
            Thread.sleep(delay);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
    
    /**
     * Simulate resource contention with significant delay
     */
    private void simulateResourceContention() {
        try {
            // Longer delay to simulate resource contention
            long delay = random.nextInt(300) + 200;
            logger.debug("Simulating resource contention: {}ms", delay);
            Thread.sleep(delay);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
    
    /**
     * Result of item processing
     */
    public static class ProcessingResult {
        private final String item;
        private final boolean success;
        private final String message;
        
        public ProcessingResult(String item, boolean success, String message) {
            this.item = item;
            this.success = success;
            this.message = message;
        }
        
        public String getItem() { return item; }
        public boolean isSuccess() { return success; }
        public String getMessage() { return message; }
        
        @Override
        public String toString() {
            return String.format("ProcessingResult{item='%s', success=%s, message='%s'}", 
                item, success, message);
        }
    }
}