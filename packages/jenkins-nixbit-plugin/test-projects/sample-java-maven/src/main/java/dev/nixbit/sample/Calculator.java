package dev.nixbit.sample;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Simple calculator class for testing flaky test scenarios
 */
public class Calculator {
    
    private static final Logger logger = LoggerFactory.getLogger(Calculator.class);
    
    /**
     * Add two numbers
     */
    public int add(int a, int b) {
        logger.debug("Adding {} + {}", a, b);
        return a + b;
    }
    
    /**
     * Subtract two numbers
     */
    public int subtract(int a, int b) {
        logger.debug("Subtracting {} - {}", a, b);
        return a - b;
    }
    
    /**
     * Multiply two numbers
     */
    public int multiply(int a, int b) {
        logger.debug("Multiplying {} * {}", a, b);
        return a * b;
    }
    
    /**
     * Divide two numbers
     */
    public double divide(int a, int b) {
        if (b == 0) {
            throw new IllegalArgumentException("Division by zero is not allowed");
        }
        logger.debug("Dividing {} / {}", a, b);
        return (double) a / b;
    }
    
    /**
     * Calculate factorial - potentially slow operation for flaky tests
     */
    public long factorial(int n) {
        if (n < 0) {
            throw new IllegalArgumentException("Factorial of negative number is undefined");
        }
        
        logger.debug("Calculating factorial of {}", n);
        
        // Simulate varying execution time for flakiness
        simulateWork();
        
        long result = 1;
        for (int i = 1; i <= n; i++) {
            result *= i;
        }
        
        return result;
    }
    
    /**
     * Check if number is prime - another potentially timing-sensitive operation
     */
    public boolean isPrime(int n) {
        if (n <= 1) {
            return false;
        }
        
        logger.debug("Checking if {} is prime", n);
        
        // Simulate network-like delays for flaky behavior
        simulateNetworkDelay();
        
        for (int i = 2; i <= Math.sqrt(n); i++) {
            if (n % i == 0) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Generate Fibonacci number - recursive implementation for performance variance
     */
    public long fibonacci(int n) {
        if (n < 0) {
            throw new IllegalArgumentException("Fibonacci of negative number is undefined");
        }
        
        logger.debug("Calculating fibonacci({})", n);
        
        // Add some randomness to execution time
        if (Math.random() < 0.1) {
            simulateWork();
        }
        
        if (n <= 1) {
            return n;
        }
        
        return fibonacci(n - 1) + fibonacci(n - 2);
    }
    
    /**
     * Simulate variable work duration for flaky test scenarios
     */
    private void simulateWork() {
        try {
            // Random delay between 1-50ms
            Thread.sleep((long) (Math.random() * 50) + 1);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
    
    /**
     * Simulate network-like delays with higher variance
     */
    private void simulateNetworkDelay() {
        try {
            // Random delay between 10-100ms, with occasional spikes
            long baseDelay = (long) (Math.random() * 90) + 10;
            
            // 5% chance of much longer delay (simulating network issues)
            if (Math.random() < 0.05) {
                baseDelay += (long) (Math.random() * 500) + 200;
            }
            
            Thread.sleep(baseDelay);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}