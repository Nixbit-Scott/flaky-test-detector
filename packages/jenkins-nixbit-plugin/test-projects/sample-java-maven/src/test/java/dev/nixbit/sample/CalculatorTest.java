package dev.nixbit.sample;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.util.Random;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;

/**
 * Test suite for Calculator with intentionally flaky tests
 */
class CalculatorTest {
    
    private Calculator calculator;
    private Random random;
    
    @BeforeEach
    void setUp() {
        calculator = new Calculator();
        random = new Random();
    }
    
    // ============ STABLE TESTS ============
    
    @Test
    void testAdd_ShouldReturnCorrectSum() {
        // Stable test - always passes
        assertThat(calculator.add(2, 3)).isEqualTo(5);
        assertThat(calculator.add(-1, 1)).isEqualTo(0);
        assertThat(calculator.add(0, 0)).isEqualTo(0);
    }
    
    @Test
    void testSubtract_ShouldReturnCorrectDifference() {
        // Stable test - always passes
        assertThat(calculator.subtract(5, 3)).isEqualTo(2);
        assertThat(calculator.subtract(1, 1)).isEqualTo(0);
        assertThat(calculator.subtract(-2, -5)).isEqualTo(3);
    }
    
    @Test
    void testMultiply_ShouldReturnCorrectProduct() {
        // Stable test - always passes
        assertThat(calculator.multiply(3, 4)).isEqualTo(12);
        assertThat(calculator.multiply(0, 10)).isEqualTo(0);
        assertThat(calculator.multiply(-2, 3)).isEqualTo(-6);
    }
    
    @Test
    void testDivide_ShouldReturnCorrectQuotient() {
        // Stable test - always passes
        assertThat(calculator.divide(10, 2)).isEqualTo(5.0);
        assertThat(calculator.divide(7, 2)).isEqualTo(3.5);
        assertThat(calculator.divide(-6, 3)).isEqualTo(-2.0);
    }
    
    @Test
    void testDivide_ShouldThrowExceptionForZeroDivisor() {
        // Stable test - always passes
        assertThatThrownBy(() -> calculator.divide(10, 0))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("Division by zero is not allowed");
    }
    
    // ============ FLAKY TESTS - TIMING BASED ============
    
    @Test
    @Timeout(value = 100, unit = TimeUnit.MILLISECONDS)
    @EnabledIfSystemProperty(named = "test.flaky.enabled", matches = "true")
    void testFactorial_FlakyDueToTimeout() {
        // Flaky test - may timeout due to variable execution time
        // Success rate: ~70% (due to simulated work delays)
        
        long result = calculator.factorial(5);
        assertThat(result).isEqualTo(120);
        
        // This might timeout due to simulateWork() delays
        result = calculator.factorial(10);
        assertThat(result).isEqualTo(3628800);
    }
    
    @Test
    @Timeout(value = 200, unit = TimeUnit.MILLISECONDS)
    @EnabledIfSystemProperty(named = "test.flaky.enabled", matches = "true")
    void testIsPrime_FlakyDueToNetworkDelay() {
        // Flaky test - may timeout due to simulated network delays
        // Success rate: ~85% (due to simulateNetworkDelay())
        
        assertThat(calculator.isPrime(17)).isTrue();
        assertThat(calculator.isPrime(25)).isFalse();
        
        // This might timeout due to network simulation
        assertThat(calculator.isPrime(97)).isTrue();
    }
    
    @RepeatedTest(3)
    @Timeout(value = 150, unit = TimeUnit.MILLISECONDS)
    @EnabledIfSystemProperty(named = "test.flaky.enabled", matches = "true")
    void testFibonacci_FlakyWithRandomDelay() {
        // Flaky test - occasionally slow due to random delays
        // Success rate: ~60% (due to random delays in fibonacci calculation)
        
        assertThat(calculator.fibonacci(5)).isEqualTo(5);
        assertThat(calculator.fibonacci(8)).isEqualTo(21);
        
        // Might be slow due to recursive nature + random delays
        assertThat(calculator.fibonacci(12)).isEqualTo(144);
    }
    
    // ============ FLAKY TESTS - RACE CONDITIONS ============
    
    @Test
    @EnabledIfSystemProperty(named = "test.flaky.enabled", matches = "true")
    void testConcurrentCalculations_FlakyRaceCondition() {
        // Flaky test - race condition due to parallel execution
        // Success rate: ~75% (when run in parallel with other tests)
        
        // Simulate concurrent access issues
        Thread thread1 = new Thread(() -> {
            for (int i = 0; i < 10; i++) {
                calculator.add(i, i);
            }
        });
        
        Thread thread2 = new Thread(() -> {
            for (int i = 0; i < 10; i++) {
                calculator.multiply(i, 2);
            }
        });
        
        thread1.start();
        thread2.start();
        
        try {
            thread1.join(50); // Short timeout - might not complete
            thread2.join(50);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        // Test may fail if threads don't complete in time
        assertThat(calculator.add(1, 1)).isEqualTo(2);
    }
    
    // ============ FLAKY TESTS - ENVIRONMENT DEPENDENT ============
    
    @Test
    @EnabledIfSystemProperty(named = "test.flaky.enabled", matches = "true")
    void testFactorial_FlakyBasedOnSystemLoad() {
        // Flaky test - depends on system load and available memory
        // Success rate: ~80% (varies based on system performance)
        
        // Add some memory pressure
        byte[][] memoryPressure = new byte[100][1024];
        for (int i = 0; i < 100; i++) {
            memoryPressure[i] = new byte[1024];
        }
        
        try {
            long result = calculator.factorial(15);
            assertThat(result).isPositive();
            
            // This calculation might be affected by system load
            long largeResult = calculator.factorial(20);
            assertThat(largeResult).isGreaterThan(result);
            
        } finally {
            // Clean up memory
            memoryPressure = null;
            System.gc();
        }
    }
    
    @Test
    @EnabledIfSystemProperty(named = "test.flaky.enabled", matches = "true")
    void testRandomizedBehavior_AlwaysFlaky() {
        // Intentionally flaky test based on random conditions
        // Success rate: ~30% (high flakiness for testing detection)
        
        double flakyFactor = Double.parseDouble(
            System.getProperty("test.flaky.factor", "0.3"));
        
        // This test will fail based on the flaky factor
        boolean shouldPass = random.nextDouble() >= flakyFactor;
        
        if (!shouldPass) {
            // Simulate various types of failures
            int failureType = random.nextInt(3);
            switch (failureType) {
                case 0:
                    throw new RuntimeException("Simulated random failure");
                case 1:
                    assertThat(1).isEqualTo(2); // Assertion failure
                    break;
                case 2:
                    throw new IllegalStateException("Random state error");
            }
        }
        
        // If we get here, the test passes
        assertThat(calculator.add(2, 2)).isEqualTo(4);
    }
    
    // ============ FLAKY TESTS - TIMING SENSITIVE ============
    
    @Test
    @EnabledIfSystemProperty(named = "test.timing.sensitive", matches = "true")
    void testTimingDependent_FlakyOnExecution() {
        // Flaky test that depends on execution timing
        // Success rate: ~65% (depends on when it runs)
        
        long startTime = System.currentTimeMillis();
        
        // Perform some calculations
        for (int i = 0; i < 100; i++) {
            calculator.add(i, i + 1);
        }
        
        long executionTime = System.currentTimeMillis() - startTime;
        
        // This assertion might fail depending on system performance
        assertThat(executionTime)
            .as("Execution should be reasonably fast")
            .isLessThan(50); // 50ms - might fail on slower systems
    }
    
    @RepeatedTest(5)
    @EnabledIfSystemProperty(named = "test.flaky.enabled", matches = "true")
    void testRepeatedFlaky_InconsistentResults() {
        // Flaky test that shows inconsistent behavior across runs
        // Success rate: ~50% per run (very visible flakiness)
        
        // Simulate test that sometimes passes, sometimes fails
        boolean coinFlip = random.nextBoolean();
        
        if (!coinFlip) {
            // Fail with a timeout simulation
            try {
                Thread.sleep(random.nextInt(100) + 50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            
            // Random failure
            if (random.nextBoolean()) {
                throw new AssertionError("Random test failure during repeated execution");
            }
        }
        
        // Basic calculation that should always work
        assertThat(calculator.multiply(3, 7)).isEqualTo(21);
    }
    
    // ============ EDGE CASE TESTS ============
    
    @Test
    void testFactorial_EdgeCases() {
        // Stable edge case tests
        assertThat(calculator.factorial(0)).isEqualTo(1);
        assertThat(calculator.factorial(1)).isEqualTo(1);
        
        assertThatThrownBy(() -> calculator.factorial(-1))
            .isInstanceOf(IllegalArgumentException.class);
    }
    
    @Test
    void testIsPrime_EdgeCases() {
        // Stable edge case tests
        assertThat(calculator.isPrime(0)).isFalse();
        assertThat(calculator.isPrime(1)).isFalse();
        assertThat(calculator.isPrime(2)).isTrue();
    }
    
    @Test
    void testFibonacci_EdgeCases() {
        // Stable edge case tests
        assertThat(calculator.fibonacci(0)).isEqualTo(0);
        assertThat(calculator.fibonacci(1)).isEqualTo(1);
        
        assertThatThrownBy(() -> calculator.fibonacci(-1))
            .isInstanceOf(IllegalArgumentException.class);
    }
}