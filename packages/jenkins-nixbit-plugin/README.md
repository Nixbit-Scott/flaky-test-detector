# Nixbit Flaky Test Detector - Jenkins Plugin

[![Jenkins Plugin](https://img.shields.io/jenkins/plugin/v/nixbit-flaky-test-detector.svg)](https://plugins.jenkins.io/nixbit-flaky-test-detector)
[![Jenkins Plugin Installs](https://img.shields.io/jenkins/plugin/i/nixbit-flaky-test-detector.svg?color=blue)](https://plugins.jenkins.io/nixbit-flaky-test-detector)

AI-powered flaky test detection for Jenkins with 94% accuracy. Automatically identifies unreliable tests and provides intelligent retry recommendations to improve your CI/CD reliability.

## Features

🔍 **Intelligent Flaky Test Detection**
- AI-powered analysis with 94% accuracy
- Historical pattern recognition
- Context-aware failure analysis

🔄 **Smart Retry Logic**
- Selective retries for flaky tests only
- Multiple backoff strategies
- Success rate optimization

📊 **Comprehensive Analytics** 
- Real-time stability scoring
- Risk level assessment
- Time waste estimation

🚀 **Enterprise Ready**
- Jenkins Pipeline support
- Freestyle project integration
- Professional UI and reporting

## Quick Start

### Installation

1. **From Jenkins Plugin Manager**:
   - Go to `Manage Jenkins` → `Manage Plugins`
   - Search for "Nixbit Flaky Test Detector"
   - Install and restart Jenkins

2. **Manual Installation**:
   ```bash
   # Build the plugin
   mvn clean package
   
   # Install the .hpi file via Jenkins UI
   # Manage Jenkins → Manage Plugins → Advanced → Upload Plugin
   ```

### Configuration

1. **Get your Nixbit API credentials**:
   - Sign up at [nixbit.dev](https://nixbit.dev)
   - Create a project and get your API key
   - Copy your Project ID from the dashboard

2. **Configure in Jenkins**:
   - Add Nixbit analysis to your build configuration
   - Enter your API URL, API Key, and Project ID
   - Configure test report patterns
   - Enable retry logic if desired

## Usage

### Freestyle Projects

1. **Add Build Step**:
   - Go to your job configuration
   - Add "Nixbit Flaky Test Analysis" post-build action
   - Configure your settings:
     - **API URL**: `https://nixbit.dev/api` (default)
     - **API Key**: Your Nixbit API key (use Jenkins credentials)
     - **Project ID**: Your project identifier
     - **Test Report Pattern**: Path to test XML files

2. **Test Report Patterns**:
   ```
   # Maven Surefire
   **/target/surefire-reports/TEST-*.xml
   
   # Gradle
   **/build/test-results/test/TEST-*.xml
   
   # Multiple patterns (comma-separated)
   **/target/surefire-reports/TEST-*.xml,**/build/test-results/test/TEST-*.xml
   ```

### Jenkins Pipeline

Add the `nixbitAnalysis` step to your Jenkinsfile:

```groovy
pipeline {
    agent any
    
    stages {
        stage('Build') {
            steps {
                // Your build steps
                sh 'mvn clean compile'
            }
        }
        
        stage('Test') {
            steps {
                // Run tests
                sh 'mvn test'
            }
            post {
                always {
                    // Standard test results
                    junit '**/target/surefire-reports/TEST-*.xml'
                    
                    // Nixbit flaky test analysis
                    nixbitAnalysis(
                        apiUrl: 'https://nixbit.dev/api',
                        apiKey: credentials('nixbit-api-key'),
                        projectId: 'your-project-id',
                        testReportPattern: '**/target/surefire-reports/TEST-*.xml',
                        enableRetryLogic: true,
                        maxRetries: 3,
                        debugMode: false
                    )
                }
            }
        }
    }
}
```

### Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `apiUrl` | String | `https://nixbit.dev/api` | Nixbit API endpoint |
| `apiKey` | String | Required | Your Nixbit API key |
| `projectId` | String | Required | Your project identifier |
| `testReportPattern` | String | `**/target/surefire-reports/TEST-*.xml,**/build/test-results/test/TEST-*.xml` | Test report file patterns |
| `enableRetryLogic` | Boolean | `true` | Enable intelligent retry recommendations |
| `maxRetries` | Integer | `3` | Maximum retries for flaky tests (1-10) |
| `debugMode` | Boolean | `false` | Enable detailed logging |

## Test Report Support

The plugin supports multiple test frameworks:

### JUnit XML Format
- Maven Surefire/Failsafe
- Gradle Test
- Ant JUnit
- Most Java testing frameworks

### TestNG XML Format
- TestNG native reports
- Maven TestNG integration

### Custom Formats
The plugin includes extensible parsers for additional test result formats.

## API Integration

### Environment Variables

The plugin automatically detects CI environment and extracts:
- Git branch and commit information
- Build metadata
- Test execution context

### Supported Variables
- `GIT_BRANCH`, `GIT_COMMIT` (Jenkins)
- `CI_COMMIT_REF_NAME`, `CI_COMMIT_SHA` (GitLab CI)
- `GITHUB_REF_NAME`, `GITHUB_SHA` (GitHub Actions)
- `BRANCH_NAME`, `BUILD_VCS_NUMBER` (Generic CI)

## Results and Analytics

### Build Page Integration

After analysis, view detailed results:
1. **Summary Widget**: Quick overview in build sidebar
2. **Full Analysis Page**: Comprehensive flaky test details
3. **Retry Recommendations**: Intelligent retry strategies

### Key Metrics

- **Flaky Test Count**: Number of potentially unreliable tests
- **Stability Score**: Overall test suite reliability percentage
- **Risk Level**: Build stability assessment (Low/Medium/High)
- **Time Wasted**: Estimated developer time lost to flaky tests

### Recommendations

The plugin provides actionable insights:
- Specific flaky test identification
- Retry strategy recommendations
- Test improvement suggestions
- Historical trend analysis

## Enterprise Features

### Security
- API key management via Jenkins credentials
- Secure XML parsing (XXE protection)
- Build isolation and clean error handling

### Performance
- Asynchronous test report processing
- Efficient XML parsing with DOM4J
- Minimal build performance impact

### Integration
- Jenkins Pipeline first-class support
- Freestyle project compatibility
- Blue Ocean UI integration
- REST API for external tools

## Troubleshooting

### Common Issues

**Connection Errors**:
```
❌ Connection failed - check your API URL and key
```
- Verify API URL and credentials
- Check network connectivity
- Ensure Nixbit service is available

**No Test Reports Found**:
```
[Nixbit] Found 0 files matching pattern
```
- Verify test report pattern
- Ensure tests have run before analysis
- Check workspace file permissions

**Parsing Errors**:
```
[Nixbit] Error parsing XML file
```
- Verify XML file format
- Check for corrupted test reports
- Enable debug mode for detailed logs

### Debug Mode

Enable debug logging for troubleshooting:

```groovy
nixbitAnalysis(
    // ... other parameters
    debugMode: true
)
```

This provides detailed logs including:
- File discovery and parsing
- API communication details
- Error stack traces
- Performance timing

### Log Analysis

Check Jenkins logs for detailed information:
```bash
# View Jenkins logs
tail -f $JENKINS_HOME/logs/jenkins.log

# Filter for Nixbit messages
grep "Nixbit" $JENKINS_HOME/logs/jenkins.log
```

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/nixbit/flaky-test-detector
cd flaky-test-detector/packages/jenkins-nixbit-plugin

# Build the plugin
mvn clean package

# The .hpi file will be in target/
ls target/*.hpi
```

### Testing

```bash
# Run unit tests
mvn test

# Run integration tests
mvn verify

# Test in local Jenkins instance
mvn hpi:run
```

### Plugin Structure

```
src/main/java/dev/nixbit/jenkins/
├── NixbitFlakyTestDetectorPlugin.java    # Main plugin class
├── NixbitApiClient.java                  # API communication
├── NixbitBuildAction.java               # Build result display
├── NixbitPipelineStep.java              # Pipeline integration
├── TestReportParser.java                # XML parsing
├── GitInfoExtractor.java                # Git information
└── models/                              # Data models

src/main/resources/
├── dev/nixbit/jenkins/                  # Jelly UI templates
│   ├── NixbitFlakyTestDetectorPlugin/
│   │   └── config.jelly                 # Configuration form
│   └── NixbitBuildAction/
│       ├── index.jelly                  # Full results page
│       └── summary.jelly                # Sidebar widget
└── META-INF/                           # Plugin metadata

src/main/webapp/
└── images/                              # Plugin icons and assets
```

## Support

### Documentation
- **Plugin Docs**: [docs.nixbit.dev/jenkins](https://docs.nixbit.dev/jenkins)
- **API Reference**: [api.nixbit.dev](https://api.nixbit.dev)
- **Best Practices**: [nixbit.dev/guides](https://nixbit.dev/guides)

### Community
- **Support Forum**: [community.nixbit.dev](https://community.nixbit.dev)
- **GitHub Issues**: [github.com/nixbit/flaky-test-detector/issues](https://github.com/nixbit/flaky-test-detector/issues)
- **Slack Community**: [nixbit.slack.com](https://nixbit.slack.com)

### Enterprise Support
- **Professional Services**: [nixbit.dev/enterprise](https://nixbit.dev/enterprise)
- **Custom Integrations**: [nixbit.dev/consulting](https://nixbit.dev/consulting)
- **SLA Support**: [nixbit.dev/support](https://nixbit.dev/support)

## License

This plugin is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## Changelog

### v1.0.0 (Current)
- Initial release
- JUnit/TestNG XML parsing
- Jenkins Pipeline support
- AI-powered flaky test detection
- Intelligent retry recommendations
- Professional UI integration

---

**Built with ❤️ by the Nixbit team**

Transform your CI/CD reliability with AI-powered flaky test detection. Get started at [nixbit.dev](https://nixbit.dev).