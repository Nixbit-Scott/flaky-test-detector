#!/bin/bash

# Nixbit Jenkins Plugin - Automated Test Runner
# This script automates testing of the Jenkins plugin with sample projects

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
JENKINS_URL="${JENKINS_URL:-http://localhost:8080}"
JENKINS_USER="${JENKINS_USER:-admin}"
JENKINS_TOKEN="${JENKINS_TOKEN:-}"
NIXBIT_API_KEY="${NIXBIT_API_KEY:-}"
PROJECT_DIR="$(dirname "$0")"
SAMPLE_PROJECT_DIR="$PROJECT_DIR/sample-java-maven"

# Test configuration
TEST_RUNS=5  # Number of test runs for flaky test detection
FLAKY_FACTOR="0.3"  # 30% flakiness for testing

echo -e "${BLUE}🧪 Nixbit Jenkins Plugin Test Runner${NC}"
echo "==============================================="

# Function to print colored output
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Java
    if ! command -v java &> /dev/null; then
        log_error "Java is required but not installed"
        exit 1
    fi
    
    java_version=$(java -version 2>&1 | grep -oP 'version "?(1\.)?\K\d+' | head -1)
    if [ "$java_version" -lt 11 ]; then
        log_error "Java 11 or higher is required. Current version: Java $java_version"
        exit 1
    fi
    
    log_success "Java $java_version found"
    
    # Check Maven
    if ! command -v mvn &> /dev/null; then
        log_error "Maven is required but not installed"
        exit 1
    fi
    
    mvn_version=$(mvn -version | head -1 | cut -d' ' -f3)
    log_success "Maven $mvn_version found"
    
    # Check Jenkins CLI availability
    if [ ! -f jenkins-cli.jar ]; then
        log_info "Downloading Jenkins CLI..."
        wget -q "$JENKINS_URL/jnlpJars/jenkins-cli.jar" || {
            log_error "Failed to download Jenkins CLI from $JENKINS_URL"
            exit 1
        }
    fi
    
    # Test Jenkins connectivity
    if ! curl -s "$JENKINS_URL" > /dev/null; then
        log_error "Cannot connect to Jenkins at $JENKINS_URL"
        exit 1
    fi
    
    log_success "Jenkins connectivity verified"
    
    # Check credentials
    if [ -z "$JENKINS_TOKEN" ]; then
        log_warning "JENKINS_TOKEN not set - some operations may require authentication"
    fi
    
    if [ -z "$NIXBIT_API_KEY" ]; then
        log_warning "NIXBIT_API_KEY not set - plugin will use configured credentials"
    fi
}

# Function to build the plugin
build_plugin() {
    log_info "Building Jenkins plugin..."
    
    cd "$PROJECT_DIR/.."
    
    if [ -f build.sh ]; then
        ./build.sh
    else
        mvn clean package -DskipTests
    fi
    
    if [ ! -f target/*.hpi ]; then
        log_error "Plugin build failed - no .hpi file found"
        exit 1
    fi
    
    PLUGIN_FILE=$(ls target/*.hpi)
    log_success "Plugin built successfully: $PLUGIN_FILE"
    
    cd "$PROJECT_DIR"
}

# Function to install plugin in Jenkins
install_plugin() {
    log_info "Installing plugin in Jenkins..."
    
    PLUGIN_FILE="../target/$(ls ../target/*.hpi | head -1 | xargs basename)"
    
    if [ -n "$JENKINS_TOKEN" ]; then
        java -jar jenkins-cli.jar -s "$JENKINS_URL" -auth "$JENKINS_USER:$JENKINS_TOKEN" install-plugin "$PLUGIN_FILE"
    else
        log_warning "Installing plugin without authentication - may require manual intervention"
        java -jar jenkins-cli.jar -s "$JENKINS_URL" install-plugin "$PLUGIN_FILE"
    fi
    
    log_success "Plugin installation initiated"
    log_info "Jenkins restart may be required..."
}

# Function to build sample project
build_sample_project() {
    log_info "Building sample Java project..."
    
    cd "$SAMPLE_PROJECT_DIR"
    
    # Clean and compile
    mvn clean compile
    
    log_success "Sample project built successfully"
    
    cd "$PROJECT_DIR"
}

# Function to run sample tests
run_sample_tests() {
    local test_profile="$1"
    local run_number="$2"
    
    log_info "Running sample tests (Profile: $test_profile, Run: $run_number)..."
    
    cd "$SAMPLE_PROJECT_DIR"
    
    # Set test properties based on profile
    case "$test_profile" in
        "stable")
            TEST_PROPS="-Dtest.flaky.enabled=false -Dtest.flaky.factor=0.0"
            ;;
        "flaky")
            TEST_PROPS="-Dtest.flaky.enabled=true -Dtest.flaky.factor=$FLAKY_FACTOR"
            ;;
        "highly-flaky")
            TEST_PROPS="-Dtest.flaky.enabled=true -Dtest.flaky.factor=0.6 -Dtest.timing.sensitive=true"
            ;;
        *)
            TEST_PROPS="-Dtest.flaky.enabled=true -Dtest.flaky.factor=$FLAKY_FACTOR"
            ;;
    esac
    
    # Run tests with failure ignore to collect all results
    mvn test $TEST_PROPS -Dmaven.test.failure.ignore=true
    
    # Check if test reports were generated
    if [ -d "target/surefire-reports" ] && [ "$(ls -A target/surefire-reports)" ]; then
        TEST_COUNT=$(find target/surefire-reports -name "TEST-*.xml" | wc -l)
        log_success "Generated $TEST_COUNT test report files"
    else
        log_warning "No test reports generated"
    fi
    
    cd "$PROJECT_DIR"
}

# Function to run integration tests
run_integration_tests() {
    local run_number="$1"
    
    log_info "Running integration tests (Run: $run_number)..."
    
    cd "$SAMPLE_PROJECT_DIR"
    
    # Run integration tests
    mvn verify -Dtest.integration.timeout=30000 -Dtest.flaky.factor=$FLAKY_FACTOR -Dmaven.test.failure.ignore=true
    
    # Check failsafe reports
    if [ -d "target/failsafe-reports" ] && [ "$(ls -A target/failsafe-reports)" ]; then
        IT_COUNT=$(find target/failsafe-reports -name "TEST-*.xml" | wc -l)
        log_success "Generated $IT_COUNT integration test report files"
    else
        log_warning "No integration test reports generated"
    fi
    
    cd "$PROJECT_DIR"
}

# Function to create Jenkins jobs
create_jenkins_jobs() {
    log_info "Creating Jenkins test jobs..."
    
    # Create freestyle job
    if [ -n "$JENKINS_TOKEN" ]; then
        java -jar jenkins-cli.jar -s "$JENKINS_URL" -auth "$JENKINS_USER:$JENKINS_TOKEN" create-job "Nixbit-Test-Freestyle" < jenkins-configs/freestyle-job-config.xml
        log_success "Freestyle job created"
        
        java -jar jenkins-cli.jar -s "$JENKINS_URL" -auth "$JENKINS_USER:$JENKINS_TOKEN" create-job "Nixbit-Test-Pipeline" < jenkins-configs/pipeline-job-config.xml
        log_success "Pipeline job created"
    else
        log_warning "Cannot create Jenkins jobs without authentication token"
        log_info "Please create jobs manually using the provided XML configurations"
    fi
}

# Function to trigger Jenkins builds
trigger_jenkins_builds() {
    log_info "Triggering Jenkins builds for testing..."
    
    if [ -z "$JENKINS_TOKEN" ]; then
        log_warning "Cannot trigger builds without authentication token"
        return
    fi
    
    # Trigger freestyle job multiple times
    for i in $(seq 1 $TEST_RUNS); do
        log_info "Triggering freestyle build $i/$TEST_RUNS..."
        java -jar jenkins-cli.jar -s "$JENKINS_URL" -auth "$JENKINS_USER:$JENKINS_TOKEN" build "Nixbit-Test-Freestyle" -p "BUILD_NUMBER=$i"
        sleep 30  # Wait between builds
    done
    
    # Trigger pipeline job with different parameters
    log_info "Triggering pipeline builds with different configurations..."
    
    # Stable tests
    java -jar jenkins-cli.jar -s "$JENKINS_URL" -auth "$JENKINS_USER:$JENKINS_TOKEN" build "Nixbit-Test-Pipeline" \
        -p "FLAKY_FACTOR=0.0" -p "ENABLE_FLAKY_TESTS=false" -p "TEST_PROFILE=stable-tests"
    
    sleep 60
    
    # Flaky tests
    java -jar jenkins-cli.jar -s "$JENKINS_URL" -auth "$JENKINS_USER:$JENKINS_TOKEN" build "Nixbit-Test-Pipeline" \
        -p "FLAKY_FACTOR=$FLAKY_FACTOR" -p "ENABLE_FLAKY_TESTS=true" -p "TEST_PROFILE=flaky-tests"
    
    sleep 60
    
    # Stress tests
    java -jar jenkins-cli.jar -s "$JENKINS_URL" -auth "$JENKINS_USER:$JENKINS_TOKEN" build "Nixbit-Test-Pipeline" \
        -p "FLAKY_FACTOR=0.5" -p "ENABLE_FLAKY_TESTS=true" -p "TEST_PROFILE=stress-test"
    
    log_success "All Jenkins builds triggered"
}

# Function to analyze test results
analyze_test_results() {
    log_info "Analyzing test results..."
    
    cd "$SAMPLE_PROJECT_DIR"
    
    # Count total tests
    TOTAL_TESTS=0
    FAILED_TESTS=0
    
    if [ -d "target/surefire-reports" ]; then
        for report in target/surefire-reports/TEST-*.xml; do
            if [ -f "$report" ]; then
                tests=$(grep -o 'tests="[0-9]*"' "$report" | cut -d'"' -f2)
                failures=$(grep -o 'failures="[0-9]*"' "$report" | cut -d'"' -f2)
                errors=$(grep -o 'errors="[0-9]*"' "$report" | cut -d'"' -f2)
                
                TOTAL_TESTS=$((TOTAL_TESTS + tests))
                FAILED_TESTS=$((FAILED_TESTS + failures + errors))
            fi
        done
    fi
    
    if [ -d "target/failsafe-reports" ]; then
        for report in target/failsafe-reports/TEST-*.xml; do
            if [ -f "$report" ]; then
                tests=$(grep -o 'tests="[0-9]*"' "$report" | cut -d'"' -f2)
                failures=$(grep -o 'failures="[0-9]*"' "$report" | cut -d'"' -f2)
                errors=$(grep -o 'errors="[0-9]*"' "$report" | cut -d'"' -f2)
                
                TOTAL_TESTS=$((TOTAL_TESTS + tests))
                FAILED_TESTS=$((FAILED_TESTS + failures + errors))
            fi
        done
    fi
    
    if [ $TOTAL_TESTS -gt 0 ]; then
        FAILURE_RATE=$(( (FAILED_TESTS * 100) / TOTAL_TESTS ))
        
        echo "📊 Test Results Summary:"
        echo "   Total Tests: $TOTAL_TESTS"
        echo "   Failed Tests: $FAILED_TESTS"
        echo "   Failure Rate: $FAILURE_RATE%"
        
        if [ $FAILURE_RATE -gt 0 ] && [ $FAILURE_RATE -lt 80 ]; then
            log_success "Test failure rate ($FAILURE_RATE%) is suitable for flaky test detection"
        elif [ $FAILURE_RATE -eq 0 ]; then
            log_warning "No test failures detected - flaky test detection may not be triggered"
        else
            log_warning "High failure rate ($FAILURE_RATE%) - may indicate issues beyond flakiness"
        fi
    else
        log_warning "No test results found for analysis"
    fi
    
    cd "$PROJECT_DIR"
}

# Function to generate test report
generate_test_report() {
    log_info "Generating test report..."
    
    REPORT_FILE="test-execution-report.md"
    
    cat > "$REPORT_FILE" << EOF
# Nixbit Jenkins Plugin Test Execution Report

Generated: $(date)

## Test Configuration
- Jenkins URL: $JENKINS_URL  
- Test Runs: $TEST_RUNS  
- Flaky Factor: $FLAKY_FACTOR  
- Sample Project: $SAMPLE_PROJECT_DIR  

## Test Results Summary
- Total Tests Executed: $TOTAL_TESTS  
- Failed Tests: $FAILED_TESTS  
- Failure Rate: ${FAILURE_RATE}%  

## Test Scenarios Executed
1. ✅ Plugin build and installation
2. ✅ Sample project compilation  
3. ✅ Unit test execution with flaky configuration
4. ✅ Integration test execution
5. ✅ Test result analysis

## Jenkins Integration
- Freestyle job configuration: ✅  
- Pipeline job configuration: ✅  
- Plugin UI integration: ⏳ (Manual verification required)
- API communication: ⏳ (Requires Nixbit credentials)

## Next Steps
1. Verify plugin appears in Jenkins UI
2. Check Nixbit analysis results in build pages
3. Validate flaky test detection accuracy
4. Test retry recommendations
5. Performance validation under load

## Files Generated
- Test reports: \`target/surefire-reports/\`
- Integration test reports: \`target/failsafe-reports/\`  
- Jenkins job configs: \`jenkins-configs/\`
- This report: \`$REPORT_FILE\`

---
*Generated by Nixbit Jenkins Plugin Test Runner*
EOF

    log_success "Test report generated: $REPORT_FILE"
}

# Function to cleanup test artifacts
cleanup() {
    log_info "Cleaning up test artifacts..."
    
    cd "$SAMPLE_PROJECT_DIR"
    mvn clean > /dev/null 2>&1 || true
    
    cd "$PROJECT_DIR"
    rm -f jenkins-cli.jar
    
    log_success "Cleanup completed"
}

# Main execution flow
main() {
    echo "Starting Nixbit Jenkins Plugin testing..."
    echo "========================================"
    
    # Parse command line arguments
    case "${1:-all}" in
        "prerequisites")
            check_prerequisites
            ;;
        "build")
            check_prerequisites
            build_plugin
            build_sample_project
            ;;
        "test")
            check_prerequisites
            build_sample_project
            run_sample_tests "flaky" 1
            run_integration_tests 1
            analyze_test_results
            ;;
        "jenkins")
            check_prerequisites
            create_jenkins_jobs
            trigger_jenkins_builds
            ;;
        "full")
            check_prerequisites
            build_plugin
            install_plugin
            build_sample_project
            
            # Run multiple test scenarios
            for i in $(seq 1 $TEST_RUNS); do
                run_sample_tests "flaky" $i
                if [ $((i % 2)) -eq 0 ]; then
                    run_integration_tests $i
                fi
                sleep 5
            done
            
            analyze_test_results
            create_jenkins_jobs
            generate_test_report
            ;;
        "cleanup")
            cleanup
            ;;
        *)
            echo "Usage: $0 [prerequisites|build|test|jenkins|full|cleanup]"
            echo ""
            echo "Commands:"
            echo "  prerequisites - Check system requirements"
            echo "  build        - Build plugin and sample project"
            echo "  test         - Run sample tests for flaky detection"
            echo "  jenkins      - Create and trigger Jenkins jobs"
            echo "  full         - Complete test execution (default)"
            echo "  cleanup      - Clean up test artifacts"
            echo ""
            echo "Environment Variables:"
            echo "  JENKINS_URL   - Jenkins server URL (default: http://localhost:8080)"
            echo "  JENKINS_USER  - Jenkins username (default: admin)"
            echo "  JENKINS_TOKEN - Jenkins API token"
            echo "  NIXBIT_API_KEY - Nixbit API key"
            exit 1
            ;;
    esac
    
    log_success "Test execution completed successfully!"
}

# Trap cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"