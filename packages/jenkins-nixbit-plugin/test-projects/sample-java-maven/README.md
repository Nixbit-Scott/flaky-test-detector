# Sample Java Maven Project for Nixbit Plugin Testing

This Maven project contains intentionally flaky tests designed to validate the Nixbit Jenkins plugin's flaky test detection capabilities.

## 🎯 Purpose

This project serves as a comprehensive test suite for the Nixbit Jenkins plugin, featuring:
- **Stable tests** that always pass
- **Intentionally flaky tests** with various failure patterns
- **Integration tests** simulating real-world scenarios
- **Configurable flakiness levels** for testing different detection scenarios

## 📁 Project Structure

```
src/
├── main/java/dev/nixbit/sample/
│   ├── Calculator.java          # Simple calculator with timing variations
│   └── DataProcessor.java       # Async operations with simulated failures
└── test/java/dev/nixbit/sample/
    ├── CalculatorTest.java      # Unit tests with various flaky patterns
    ├── DataProcessorTest.java   # Complex async and concurrency tests
    └── DataProcessorIT.java     # Integration tests with external dependencies
```

## 🧪 Test Categories

### Stable Tests (Always Pass)
- Basic arithmetic operations
- Input validation
- Edge case handling
- These tests validate that the plugin doesn't flag stable tests as flaky

### Flaky Tests by Category

#### 1. Timing-Based Flaky Tests
- **Timeout Issues**: Tests that occasionally exceed time limits
- **Variable Delays**: Tests with random execution delays
- **Performance Sensitive**: Tests affected by system load

Success Rate: ~60-85% depending on system performance

#### 2. Race Condition Tests  
- **Concurrent Access**: Tests with thread synchronization issues
- **Resource Contention**: Tests competing for shared resources
- **Parallel Execution**: Tests that fail when run in parallel

Success Rate: ~70-80% depending on parallel execution

#### 3. Environment-Dependent Tests
- **Memory Pressure**: Tests that fail under low memory conditions
- **System Load**: Tests sensitive to CPU usage
- **Network Simulation**: Tests with simulated network issues

Success Rate: ~75-90% depending on environment

#### 4. Random Failure Tests
- **Probabilistic Failures**: Tests with configurable failure rates
- **Simulated External Services**: Tests mimicking external API failures
- **Random State Errors**: Tests with various random failure modes

Success Rate: Configurable via system properties

## ⚙️ Configuration

### System Properties

| Property | Default | Description |
|----------|---------|-------------|
| `test.flaky.enabled` | `false` | Enable flaky test execution |
| `test.flaky.factor` | `0.3` | Flakiness factor (0.0-1.0) |
| `test.timing.sensitive` | `false` | Enable timing-sensitive tests |
| `test.integration.timeout` | `30000` | Integration test timeout (ms) |

### Maven Profiles

**Standard Profile** (default):
```bash
mvn test
```

**Flaky Tests Profile**:
```bash
mvn test -Pflaky-tests -Dtest.flaky.enabled=true
```

**Stable Tests Only**:
```bash
mvn test -Pstable-tests -Dtest.flaky.enabled=false
```

## 🚀 Running Tests

### Basic Test Execution
```bash
# Compile the project
mvn clean compile

# Run stable tests only
mvn test -Dtest.flaky.enabled=false

# Run with 30% flakiness
mvn test -Dtest.flaky.enabled=true -Dtest.flaky.factor=0.3

# Run with high flakiness for clear detection
mvn test -Dtest.flaky.enabled=true -Dtest.flaky.factor=0.6 -Dtest.timing.sensitive=true
```

### Integration Tests
```bash
# Run integration tests
mvn verify -Dtest.integration.timeout=30000

# Run with flaky configuration
mvn verify -Dtest.flaky.enabled=true -Dtest.flaky.factor=0.25
```

### Parallel Execution (Increases Flakiness)
```bash
mvn test -Dtest.flaky.enabled=true -T 4 -Dparallel=methods -DthreadCount=4
```

## 📊 Expected Test Results

### With Flaky Tests Disabled
- **Total Tests**: ~45
- **Passing Tests**: ~45 (100%)
- **Flaky Tests Detected**: 0
- **Build Result**: SUCCESS

### With 30% Flaky Factor
- **Total Tests**: ~45
- **Passing Tests**: ~30-35 (67-78%)
- **Flaky Tests Detected**: ~10-15
- **Build Result**: UNSTABLE

### With 60% Flaky Factor  
- **Total Tests**: ~45
- **Passing Tests**: ~15-25 (33-56%)
- **Flaky Tests Detected**: ~20-25
- **Build Result**: UNSTABLE/FAILURE

## 🔍 Flaky Test Patterns

### Pattern 1: Timeout-Based Flakiness
```java
@Test
@Timeout(value = 100, unit = TimeUnit.MILLISECONDS)
void testWithTimeout() {
    // Occasionally exceeds timeout due to simulated delays
    calculator.factorial(10); // Has random delays
}
```

### Pattern 2: Random Failure
```java
@Test
void testRandomFailure() {
    double flakyFactor = Double.parseDouble(
        System.getProperty("test.flaky.factor", "0.3"));
    
    if (random.nextDouble() < flakyFactor) {
        throw new RuntimeException("Simulated random failure");
    }
    // Test logic...
}
```

### Pattern 3: Race Condition
```java
@Test  
void testRaceCondition() {
    // Concurrent threads that may not complete in time
    Thread.sleep(random.nextInt(50)); // Variable timing
    // Assertions that depend on timing
}
```

### Pattern 4: Environment Dependency
```java
@Test
void testEnvironmentDependency() {
    // Create memory pressure
    byte[][] data = new byte[100][1024];
    
    // Test that might fail under memory pressure
    performMemoryIntensiveOperation();
}
```

## 🎛️ Jenkins Integration

### Freestyle Job Configuration
```xml
<hudson.tasks.Maven>
  <targets>test -Dtest.flaky.enabled=true -Dtest.flaky.factor=0.3</targets>
  <mavenName>Maven-3.9</mavenName>
</hudson.tasks.Maven>
```

### Pipeline Configuration
```groovy
stage('Test') {
    steps {
        sh 'mvn test -Dtest.flaky.enabled=true -Dtest.flaky.factor=0.3'
    }
    post {
        always {
            junit '**/target/surefire-reports/TEST-*.xml'
            
            nixbitAnalysis(
                apiKey: credentials('nixbit-api-key'),
                projectId: 'sample-java-maven',
                testReportPattern: '**/target/surefire-reports/TEST-*.xml'
            )
        }
    }
}
```

## 📈 Validation Scenarios

### Scenario 1: Detection Accuracy
Run multiple builds with consistent flaky factor to validate detection accuracy:
```bash
for i in {1..10}; do
  mvn clean test -Dtest.flaky.enabled=true -Dtest.flaky.factor=0.3
  echo "Build $i completed"
done
```

### Scenario 2: Stability Trends
Run builds with different flaky factors to test stability scoring:
```bash
# Low flakiness
mvn test -Dtest.flaky.factor=0.1

# Medium flakiness  
mvn test -Dtest.flaky.factor=0.3

# High flakiness
mvn test -Dtest.flaky.factor=0.6
```

### Scenario 3: Integration Testing
Test with integration tests to validate complex scenario detection:
```bash
mvn verify -Dtest.flaky.enabled=true -Dtest.integration.timeout=15000
```

## 🐛 Known Flaky Tests

The following tests are intentionally flaky for validation:

| Test Name | Flaky Pattern | Success Rate |
|-----------|---------------|--------------|
| `testFactorial_FlakyDueToTimeout` | Timeout | ~70% |
| `testIsPrime_FlakyDueToNetworkDelay` | Network delay | ~85% |
| `testRandomizedBehavior_AlwaysFlaky` | Random failure | ~30% |
| `testTimingDependent_FlakyOnExecution` | Timing sensitive | ~65% |
| `testFetchDataAsync_FlakyTimeout` | Async timeout | ~75% |
| `testProcessBatch_FlakyResourceContention` | Resource contention | ~85% |
| `testDatabaseIntegration_FlakyConnection` | DB simulation | ~80% |
| `testMicroserviceChain_FlakyServiceDependencies` | Service chain | ~65% |

## 🔧 Troubleshooting

### No Flaky Tests Detected
- Ensure `test.flaky.enabled=true`
- Increase `test.flaky.factor` value
- Run multiple builds to see pattern variations

### All Tests Failing
- Decrease `test.flaky.factor` value
- Check system resources (memory, CPU)
- Disable timing-sensitive tests

### Inconsistent Results
- This is expected behavior for flaky tests
- Run multiple builds to establish patterns
- Use different flaky factors to test detection

## 📞 Support

For questions about this test project:
- Check the main [TESTING_GUIDE.md](../TESTING_GUIDE.md)  
- Review Jenkins plugin documentation
- Open issues in the main repository

---

**This sample project demonstrates realistic flaky test patterns that the Nixbit Jenkins plugin should detect and provide intelligent recommendations for handling.**