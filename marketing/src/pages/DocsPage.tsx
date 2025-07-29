import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Code, 
  Zap, 
  Shield, 
  GitBranch, 
  Copy,
  ExternalLink,
  ArrowRight,
  BookOpen,
  Settings,
  Webhook
} from 'lucide-react'

const DocsPage: React.FC = () => {
  const [selectedLanguage, setSelectedLanguage] = useState<'curl' | 'javascript' | 'python' | 'go'>('curl')
  const [copySuccess, setCopySuccess] = useState('')

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopySuccess('Copied!')
      setTimeout(() => setCopySuccess(''), 2000)
    } catch (err) {
      setCopySuccess('Failed to copy')
      setTimeout(() => setCopySuccess(''), 2000)
    }
  }

  const CodeBlock: React.FC<{ code: string; language: string }> = ({ code, language }) => (
    <div className="relative">
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
        <code className={`language-${language}`}>{code}</code>
      </pre>
      <button
        onClick={() => copyToClipboard(code)}
        className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white transition-colors"
      >
        <Copy className="h-4 w-4" />
      </button>
    </div>
  )

  const getQuickStartCode = () => {
    const examples = {
      curl: `# 1. Submit test results
curl -X POST https://api.nixbit.dev/test-results \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_TOKEN" \\
  -d '{
    "projectId": "your-project-id",
    "testSuiteName": "Unit Tests",
    "branch": "main",
    "commit": "abc123",
    "tests": [
      {
        "name": "test_user_login",
        "status": "passed",
        "duration": 150
      },
      {
        "name": "test_flaky_network",
        "status": "failed",
        "duration": 5000,
        "errorMessage": "Connection timeout"
      }
    ]
  }'

# 2. Get flaky test analysis
curl -X GET "https://api.nixbit.dev/flaky-analysis?projectId=your-project-id" \\
  -H "Authorization: Bearer YOUR_API_TOKEN"`,

      javascript: `// Install: npm install axios
const axios = require('axios');

const apiClient = axios.create({
  baseURL: 'https://api.nixbit.dev',
  headers: {
    'Authorization': 'Bearer YOUR_API_TOKEN',
    'Content-Type': 'application/json'
  }
});

// 1. Submit test results
async function submitTestResults() {
  const response = await apiClient.post('/test-results', {
    projectId: 'your-project-id',
    testSuiteName: 'Unit Tests',
    branch: 'main',
    commit: 'abc123',
    tests: [
      {
        name: 'test_user_login',
        status: 'passed',
        duration: 150
      },
      {
        name: 'test_flaky_network',
        status: 'failed',
        duration: 5000,
        errorMessage: 'Connection timeout'
      }
    ]
  });
  
  console.log('Results submitted:', response.data);
}

// 2. Get flaky test analysis
async function getFlakyTests() {
  const response = await apiClient.get('/flaky-analysis', {
    params: { projectId: 'your-project-id' }
  });
  
  console.log('Flaky tests:', response.data.flakyTests);
}`,

      python: `# Install: pip install requests
import requests
import json

API_BASE_URL = 'https://api.nixbit.dev'
API_TOKEN = 'YOUR_API_TOKEN'

headers = {
    'Authorization': f'Bearer {API_TOKEN}',
    'Content-Type': 'application/json'
}

# 1. Submit test results
def submit_test_results():
    payload = {
        'projectId': 'your-project-id',
        'testSuiteName': 'Unit Tests',
        'branch': 'main',
        'commit': 'abc123',
        'tests': [
            {
                'name': 'test_user_login',
                'status': 'passed',
                'duration': 150
            },
            {
                'name': 'test_flaky_network',
                'status': 'failed',
                'duration': 5000,
                'errorMessage': 'Connection timeout'
            }
        ]
    }
    
    response = requests.post(
        f'{API_BASE_URL}/test-results',
        headers=headers,
        json=payload
    )
    
    print('Results submitted:', response.json())

# 2. Get flaky test analysis
def get_flaky_tests():
    response = requests.get(
        f'{API_BASE_URL}/flaky-analysis',
        headers=headers,
        params={'projectId': 'your-project-id'}
    )
    
    print('Flaky tests:', response.json()['flakyTests'])`,

      go: `// go mod init your-project && go get github.com/go-resty/resty/v2
package main

import (
    "encoding/json"
    "fmt"
    "github.com/go-resty/resty/v2"
)

const (
    APIBaseURL = "https://api.nixbit.dev"
    APIToken   = "YOUR_API_TOKEN"
)

type TestResult struct {
    Name         string \`json:"name"\`
    Status       string \`json:"status"\`
    Duration     int    \`json:"duration,omitempty"\`
    ErrorMessage string \`json:"errorMessage,omitempty"\`
}

type TestSubmission struct {
    ProjectId     string       \`json:"projectId"\`
    TestSuiteName string       \`json:"testSuiteName"\`
    Branch        string       \`json:"branch"\`
    Commit        string       \`json:"commit"\`
    Tests         []TestResult \`json:"tests"\`
}

func main() {
    client := resty.New()
    client.SetHeader("Authorization", "Bearer "+APIToken)
    client.SetHeader("Content-Type", "application/json")
    
    // 1. Submit test results
    submission := TestSubmission{
        ProjectId:     "your-project-id",
        TestSuiteName: "Unit Tests",
        Branch:        "main",
        Commit:        "abc123",
        Tests: []TestResult{
            {Name: "test_user_login", Status: "passed", Duration: 150},
            {Name: "test_flaky_network", Status: "failed", Duration: 5000, ErrorMessage: "Connection timeout"},
        },
    }
    
    resp, err := client.R().
        SetBody(submission).
        Post(APIBaseURL + "/test-results")
    
    if err != nil {
        fmt.Printf("Error: %v\\n", err)
        return
    }
    
    fmt.Printf("Results submitted: %s\\n", resp.String())
    
    // 2. Get flaky test analysis
    resp, err = client.R().
        SetQueryParam("projectId", "your-project-id").
        Get(APIBaseURL + "/flaky-analysis")
    
    if err != nil {
        fmt.Printf("Error: %v\\n", err)
        return
    }
    
    fmt.Printf("Flaky tests: %s\\n", resp.String())
}`
    }

    return examples[selectedLanguage]
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-white border-b border-gray-200">
        <div className="container-custom section-padding">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-6">
              <BookOpen className="h-8 w-8 text-primary-600" />
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              API Documentation
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Integrate Nixbit's AI-powered flaky test detection into your CI/CD pipeline. 
              Get started in minutes with our simple REST API.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/signup" className="btn-primary">
                Get API Access
              </Link>
              <a 
                href="https://app.nixbit.dev/docs" 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-outline inline-flex items-center"
              >
                Full API Reference
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quick Start Section */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Quick Start Guide
            </h2>
            <p className="text-lg text-gray-600">
              Get up and running with Nixbit API in under 5 minutes
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            {/* Steps */}
            <div className="space-y-12 mb-12">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center font-semibold mr-6">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Sign up and get your API token
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Create your free account and generate an API token from your dashboard settings.
                  </p>
                  <Link to="/signup" className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium">
                    Create free account
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center font-semibold mr-6">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Choose your integration method
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Select your preferred language and integration approach.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(['curl', 'javascript', 'python', 'go'] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setSelectedLanguage(lang)}
                        className={`px-3 py-2 rounded border text-sm font-medium ${
                          selectedLanguage === lang
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {lang === 'curl' ? 'cURL' : lang.charAt(0).toUpperCase() + lang.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center font-semibold mr-6">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Send your first test results
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Use our API to submit test results and get flaky test analysis.
                  </p>
                  <CodeBlock code={getQuickStartCode()} language={selectedLanguage} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              API Capabilities
            </h2>
            <p className="text-lg text-gray-600">
              Powerful features to integrate flaky test detection into your workflow
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="card card-hover"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                AI-Powered Detection
              </h3>
              <p className="text-gray-600 text-sm">
                Submit test results and get intelligent flaky test detection with 94% accuracy using machine learning.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="card card-hover"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mb-4">
                <GitBranch className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                CI/CD Integration
              </h3>
              <p className="text-gray-600 text-sm">
                Native webhooks for GitHub Actions, GitLab CI, Jenkins, and custom systems with automatic setup.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="card card-hover"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mb-4">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Quarantine Management
              </h3>
              <p className="text-gray-600 text-sm">
                Automatically quarantine flaky tests to prevent pipeline failures while maintaining development velocity.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="card card-hover"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-100 rounded-lg mb-4">
                <Settings className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Custom Retry Logic
              </h3>
              <p className="text-gray-600 text-sm">
                Configure intelligent retry policies that adapt to different test types and failure patterns.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="card card-hover"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-lg mb-4">
                <Webhook className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Real-time Webhooks
              </h3>
              <p className="text-gray-600 text-sm">
                Get instant notifications when flaky tests are detected or quarantined via webhooks.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="card card-hover"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-lg mb-4">
                <Code className="h-6 w-6 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Multi-language SDKs
              </h3>
              <p className="text-gray-600 text-sm">
                Official SDKs and code examples for JavaScript, Python, Go, and more languages coming soon.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* API Endpoints Preview */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Core API Endpoints
            </h2>
            <p className="text-lg text-gray-600">
              Essential endpoints to get you started
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-6">
            <div className="card">
              <div className="flex items-center mb-4">
                <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded-full mr-3">POST</span>
                <code className="text-lg font-mono text-gray-900">/test-results</code>
              </div>
              <p className="text-gray-600 mb-3">
                Submit test results for AI-powered flaky test detection and analysis.
              </p>
              <div className="text-sm text-gray-500">
                Parameters: projectId, tests[], branch, commit, buildNumber
              </div>
            </div>

            <div className="card">
              <div className="flex items-center mb-4">
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full mr-3">GET</span>
                <code className="text-lg font-mono text-gray-900">/flaky-analysis</code>
              </div>
              <p className="text-gray-600 mb-3">
                Get detailed flaky test analysis, patterns, and recommendations for your project.
              </p>
              <div className="text-sm text-gray-500">
                Parameters: projectId, branch (optional), days (optional)
              </div>
            </div>

            <div className="card">
              <div className="flex items-center mb-4">
                <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-0.5 rounded-full mr-3">POST</span>
                <code className="text-lg font-mono text-gray-900">/quarantine</code>
              </div>
              <p className="text-gray-600 mb-3">
                Manage test quarantine settings and policies for automatic flaky test isolation.
              </p>
              <div className="text-sm text-gray-500">
                Parameters: projectId, testName, action (quarantine/unquarantine)
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <a 
              href="https://app.nixbit.dev/docs" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center"
            >
              View Complete API Reference
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-primary-600">
        <div className="container-custom text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Start Building?
            </h2>
            <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
              Get your API token and start detecting flaky tests in your CI/CD pipeline today.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link 
                to="/signup" 
                className="bg-white text-primary-600 hover:bg-gray-50 px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                Get Free API Access
              </Link>
              <Link 
                to="/contact" 
                className="border border-primary-300 text-white hover:bg-primary-700 px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                Talk to Sales
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {copySuccess && (
        <div className="fixed bottom-4 right-4 bg-green-100 text-green-800 px-4 py-2 rounded-lg shadow-lg">
          {copySuccess}
        </div>
      )}
    </div>
  )
}

export default DocsPage