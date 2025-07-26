import React, { useState } from 'react';

interface ApiDocumentationProps {
  projectId?: string;
}

const ApiDocumentation: React.FC<ApiDocumentationProps> = ({ projectId }) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'quickstart' | 'authentication' | 'endpoints' | 'webhooks' | 'examples'>('overview');
  const [selectedLanguage, setSelectedLanguage] = useState<'curl' | 'javascript' | 'python' | 'go'>('curl');
  const [copySuccess, setCopySuccess] = useState('');

  const baseUrl = window.location.origin;
  const apiBaseUrl = `${baseUrl}/.netlify/functions`;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess('Copied!');
      setTimeout(() => setCopySuccess(''), 2000);
    } catch (err) {
      setCopySuccess('Failed to copy');
      setTimeout(() => setCopySuccess(''), 2000);
    }
  };

  const CodeBlock: React.FC<{ code: string; language: string }> = ({ code, language }) => (
    <div className="relative">
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
        <code className={`language-${language}`}>{code}</code>
      </pre>
      <button
        onClick={() => copyToClipboard(code)}
        className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 text-gray-200 rounded hover:bg-gray-600"
      >
        Copy
      </button>
    </div>
  );

  const getQuickStartCode = () => {
    const examples = {
      curl: `# 1. Submit test results
curl -X POST ${apiBaseUrl}/test-results \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_TOKEN" \\
  -d '{
    "projectId": "${projectId || 'your-project-id'}",
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
curl -X GET "${apiBaseUrl}/flaky-analysis?projectId=${projectId || 'your-project-id'}" \\
  -H "Authorization: Bearer YOUR_API_TOKEN"`,

      javascript: `// Install: npm install axios
const axios = require('axios');

const apiClient = axios.create({
  baseURL: '${apiBaseUrl}',
  headers: {
    'Authorization': 'Bearer YOUR_API_TOKEN',
    'Content-Type': 'application/json'
  }
});

// 1. Submit test results
async function submitTestResults() {
  const response = await apiClient.post('/test-results', {
    projectId: '${projectId || 'your-project-id'}',
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
    params: { projectId: '${projectId || 'your-project-id'}' }
  });
  
  console.log('Flaky tests:', response.data.flakyTests);
}`,

      python: `# Install: pip install requests
import requests
import json

API_BASE_URL = '${apiBaseUrl}'
API_TOKEN = 'YOUR_API_TOKEN'

headers = {
    'Authorization': f'Bearer {API_TOKEN}',
    'Content-Type': 'application/json'
}

# 1. Submit test results
def submit_test_results():
    payload = {
        'projectId': '${projectId || 'your-project-id'}',
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
        params={'projectId': '${projectId || 'your-project-id'}'}
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
    APIBaseURL = "${apiBaseUrl}"
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
        ProjectId:     "${projectId || 'your-project-id'}",
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
        SetQueryParam("projectId", "${projectId || 'your-project-id'}").
        Get(APIBaseURL + "/flaky-analysis")
    
    if err != nil {
        fmt.Printf("Error: %v\\n", err)
        return
    }
    
    fmt.Printf("Flaky tests: %s\\n", resp.String())
}`
    };

    return examples[selectedLanguage];
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Flaky Test Detector API</h2>
        <p className="text-gray-600 mb-6">
          Integrate flaky test detection into your CI/CD pipeline with our comprehensive REST API. 
          Automatically detect intermittent test failures, get intelligent recommendations, and improve your test reliability.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
          <div className="flex items-center mb-3">
            <svg className="w-6 h-6 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h3 className="text-lg font-semibold text-blue-900">Quick Start</h3>
          </div>
          <p className="text-blue-800 text-sm mb-4">
            Get up and running in under 5 minutes with our simple REST API.
          </p>
          <button
            onClick={() => setActiveSection('quickstart')}
            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
          >
            View Quick Start Guide →
          </button>
        </div>

        <div className="bg-green-50 p-6 rounded-lg border border-green-200">
          <div className="flex items-center mb-3">
            <svg className="w-6 h-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold text-green-900">CI/CD Integration</h3>
          </div>
          <p className="text-green-800 text-sm mb-4">
            Pre-built integrations for GitHub Actions, GitLab CI, Jenkins, and more.
          </p>
          <button
            onClick={() => setActiveSection('webhooks')}
            className="text-green-600 hover:text-green-800 font-medium text-sm"
          >
            Setup Webhooks →
          </button>
        </div>

        <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
          <div className="flex items-center mb-3">
            <svg className="w-6 h-6 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 className="text-lg font-semibold text-purple-900">API Reference</h3>
          </div>
          <p className="text-purple-800 text-sm mb-4">
            Complete documentation for all endpoints, parameters, and responses.
          </p>
          <button
            onClick={() => setActiveSection('endpoints')}
            className="text-purple-600 hover:text-purple-800 font-medium text-sm"
          >
            Browse API Reference →
          </button>
        </div>

        <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
          <div className="flex items-center mb-3">
            <svg className="w-6 h-6 text-orange-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <h3 className="text-lg font-semibold text-orange-900">Code Examples</h3>
          </div>
          <p className="text-orange-800 text-sm mb-4">
            Ready-to-use code snippets in cURL, JavaScript, Python, and Go.
          </p>
          <button
            onClick={() => setActiveSection('examples')}
            className="text-orange-600 hover:text-orange-800 font-medium text-sm"
          >
            View Code Examples →
          </button>
        </div>
      </div>

      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Base URL</h3>
        <div className="flex items-center space-x-2">
          <code className="bg-white px-3 py-2 rounded border text-sm flex-1 font-mono">
            {apiBaseUrl}
          </code>
          <button
            onClick={() => copyToClipboard(apiBaseUrl)}
            className="px-3 py-2 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );

  const renderQuickStart = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Start Guide</h2>
        <p className="text-gray-600 mb-6">
          Get started with the Flaky Test Detector API in just a few steps.
        </p>
      </div>

      <div className="space-y-8">
        <div className="flex">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm mr-4">
            1
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Get Your API Token</h3>
            <p className="text-gray-600 mb-3">
              Navigate to your project settings and generate an API token for authentication.
            </p>
            <div className="bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
              <p className="text-yellow-800 text-sm">
                <strong>Note:</strong> Keep your API token secure and never commit it to version control.
              </p>
            </div>
          </div>
        </div>

        <div className="flex">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm mr-4">
            2
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Choose Your Integration Method</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              {(['curl', 'javascript', 'python', 'go'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`px-3 py-2 rounded border text-sm font-medium ${
                    selectedLanguage === lang
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {lang === 'curl' ? 'cURL' : lang.charAt(0).toUpperCase() + lang.slice(1)}
                </button>
              ))}
            </div>
            <CodeBlock code={getQuickStartCode()} language={selectedLanguage} />
          </div>
        </div>

        <div className="flex">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm mr-4">
            3
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">View Results in Dashboard</h3>
            <p className="text-gray-600 mb-3">
              Once you start sending test results, you'll see them appear in your project dashboard with automatic flaky test detection.
            </p>
            <div className="bg-green-50 p-3 rounded border-l-4 border-green-400">
              <p className="text-green-800 text-sm">
                <strong>Success!</strong> Your test results will now be analyzed for flaky patterns automatically.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const navigation = [
    { key: 'overview', label: 'Overview', icon: '📖' },
    { key: 'quickstart', label: 'Quick Start', icon: '🚀' },
    { key: 'authentication', label: 'Authentication', icon: '🔐' },
    { key: 'endpoints', label: 'API Reference', icon: '📚' },
    { key: 'webhooks', label: 'Webhooks', icon: '🔗' },
    { key: 'examples', label: 'Code Examples', icon: '💻' },
  ];

  const renderAuthentication = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication</h2>
        <p className="text-gray-600 mb-6">
          The Flaky Test Detector API uses Bearer token authentication. Generate an API token from your project settings to authenticate your requests.
        </p>
      </div>

      <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">Getting Your API Token</h3>
        <div className="space-y-3 text-sm text-blue-800">
          <p>1. Navigate to your project settings in the dashboard</p>
          <p>2. Go to the "API Tokens" section</p>
          <p>3. Click "Generate New Token"</p>
          <p>4. Give your token a descriptive name (e.g., "CI/CD Integration")</p>
          <p>5. Copy the token immediately - it won't be shown again</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Authentication Header</h3>
        <p className="text-gray-600 text-sm mb-3">
          Include your API token in the Authorization header of all requests:
        </p>
        <CodeBlock 
          code={`Authorization: Bearer YOUR_API_TOKEN`} 
          language="http" 
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Example Request</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['curl', 'javascript'] as const).map((lang) => (
            <div key={lang}>
              <h4 className="text-sm font-medium text-gray-700 mb-2 capitalize">{lang}</h4>
              <CodeBlock
                code={lang === 'curl' ? 
                  `curl -X GET "${apiBaseUrl}/projects" \\
  -H "Authorization: Bearer YOUR_API_TOKEN" \\
  -H "Content-Type: application/json"` :
                  `const response = await fetch('${apiBaseUrl}/projects', {
  headers: {
    'Authorization': 'Bearer YOUR_API_TOKEN',
    'Content-Type': 'application/json'
  }
});`
                }
                language={lang}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-400">
        <div className="flex">
          <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-red-800">Security Best Practices</h4>
            <ul className="text-sm text-red-700 mt-2 space-y-1">
              <li>• Never commit API tokens to version control</li>
              <li>• Use environment variables to store tokens</li>
              <li>• Rotate tokens regularly</li>
              <li>• Use different tokens for different environments</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEndpoints = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">API Reference</h2>
        <p className="text-gray-600 mb-6">
          Complete reference for all available endpoints, parameters, and response formats.
        </p>
      </div>

      {/* Test Results Endpoints */}
      <div className="border border-gray-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded-full mr-3">POST</span>
          <h3 className="text-lg font-semibold text-gray-900">/test-results</h3>
        </div>
        <p className="text-gray-600 mb-4">Submit test results for analysis and flaky test detection.</p>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Request Body</h4>
            <CodeBlock
              code={`{
  "projectId": "${projectId || 'your-project-id'}",
  "testSuiteName": "Unit Tests",
  "branch": "main",
  "commit": "abc123",
  "buildNumber": "42",
  "timestamp": "2024-01-20T10:30:00Z",
  "tests": [
    {
      "name": "test_user_authentication",
      "status": "passed",
      "duration": 150,
      "retryCount": 0
    },
    {
      "name": "test_database_connection",
      "status": "failed",
      "duration": 5000,
      "errorMessage": "Connection timeout",
      "stackTrace": "Error: timeout...",
      "retryCount": 2
    }
  ]
}`}
              language="json"
            />
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Response</h4>
            <CodeBlock
              code={`{
  "success": true,
  "testRunId": "run_abc123",
  "testsProcessed": 2,
  "flakyTestsDetected": 1,
  "message": "Test results processed successfully"
}`}
              language="json"
            />
          </div>
        </div>
      </div>

      {/* Flaky Analysis Endpoint */}
      <div className="border border-gray-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full mr-3">GET</span>
          <h3 className="text-lg font-semibold text-gray-900">/flaky-analysis</h3>
        </div>
        <p className="text-gray-600 mb-4">Get flaky test analysis and patterns for a project.</p>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Query Parameters</h4>
            <div className="bg-gray-50 p-3 rounded">
              <code className="text-sm">?projectId={projectId || 'your-project-id'}&branch=main&days=30</code>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Response</h4>
            <CodeBlock
              code={`{
  "flakyTests": [
    {
      "testName": "test_database_connection",
      "flakyScore": 0.85,
      "failureRate": 0.15,
      "totalRuns": 100,
      "failures": 15,
      "avgDuration": 4500,
      "lastFailure": "2024-01-20T09:15:00Z",
      "patterns": [
        "Fails more often on weekends",
        "Higher failure rate after 5pm"
      ]
    }
  ],
  "summary": {
    "totalTests": 150,
    "flakyTests": 3,
    "flakinessScore": 0.12,
    "recommendation": "Focus on database connection reliability"
  }
}`}
              language="json"
            />
          </div>
        </div>
      </div>

      {/* Projects Endpoint */}
      <div className="border border-gray-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full mr-3">GET</span>
          <h3 className="text-lg font-semibold text-gray-900">/projects</h3>
        </div>
        <p className="text-gray-600 mb-4">List all projects associated with your account.</p>
        
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Response</h4>
          <CodeBlock
            code={`{
  "projects": [
    {
      "id": "project-abc123",
      "name": "My Web App",
      "repository": "github.com/user/web-app",
      "createdAt": "2024-01-01T00:00:00Z",
      "testRuns": 1250,
      "flakyTests": 5,
      "lastActivity": "2024-01-20T10:30:00Z"
    }
  ]
}`}
            language="json"
          />
        </div>
      </div>
    </div>
  );

  const renderWebhooks = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Webhook Integration</h2>
        <p className="text-gray-600 mb-6">
          Integrate with your CI/CD pipeline using webhooks. We support GitHub Actions, GitLab CI, Jenkins, and any custom system.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { name: 'GitHub Actions', url: `${baseUrl}/.netlify/functions/webhook-github`, color: 'bg-gray-900' },
          { name: 'GitLab CI', url: `${baseUrl}/.netlify/functions/webhook-gitlab`, color: 'bg-orange-500' },
          { name: 'Jenkins', url: `${baseUrl}/.netlify/functions/webhook-jenkins`, color: 'bg-blue-600' },
          { name: 'Generic', url: `${baseUrl}/.netlify/functions/webhook-generic`, color: 'bg-green-600' }
        ].map((webhook) => (
          <div key={webhook.name} className="border border-gray-200 rounded-lg p-4">
            <div className={`w-8 h-8 ${webhook.color} rounded mb-3`}></div>
            <h3 className="font-semibold text-gray-900 mb-2">{webhook.name}</h3>
            <p className="text-xs text-gray-600 mb-3 font-mono break-all">{webhook.url}</p>
            <button
              onClick={() => copyToClipboard(webhook.url)}
              className="w-full px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Copy URL
            </button>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Generic Webhook Payload</h3>
        <p className="text-gray-600 mb-4 text-sm">
          For systems not listed above, use the generic webhook with this flexible payload format:
        </p>
        <CodeBlock
          code={`{
  "projectId": "your-project-id",
  "buildStatus": "success", // or "failed", "error"
  "branch": "main",
  "commit": "abc123",
  "buildNumber": "42",
  "testResults": {
    "testSuiteName": "CI Tests",
    "tests": [
      {
        "name": "test_login",
        "status": "passed", // or "failed", "skipped"
        "duration": 150,
        "errorMessage": "Optional error message"
      }
    ]
  }
}`}
          language="json"
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Webhook Security</h3>
        <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
          <div className="flex">
            <svg className="w-5 h-5 text-yellow-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-yellow-800">Webhook Verification</h4>
              <p className="text-sm text-yellow-700 mt-1">
                For production use, consider adding webhook signature verification or using HTTPS endpoints with authentication headers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderExamples = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Code Examples</h2>
        <p className="text-gray-600 mb-6">
          Complete integration examples for different programming languages and use cases.
        </p>
      </div>

      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Language Selection</h3>
          <div className="flex space-x-2">
            {(['curl', 'javascript', 'python', 'go'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setSelectedLanguage(lang)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium ${
                  selectedLanguage === lang
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {lang === 'curl' ? 'cURL' : lang.charAt(0).toUpperCase() + lang.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Complete Integration Example</h3>
          <CodeBlock code={getCompleteExample()} language={selectedLanguage} />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Error Handling</h3>
          <CodeBlock code={getErrorHandlingExample()} language={selectedLanguage} />
        </div>
      </div>
    </div>
  );

  const getCompleteExample = () => {
    const examples = {
      curl: `#!/bin/bash
# Complete Flaky Test Detector Integration Script

API_BASE="${apiBaseUrl}"
API_TOKEN="YOUR_API_TOKEN"
PROJECT_ID="${projectId || 'your-project-id'}"

# Function to submit test results
submit_test_results() {
  local status=$1
  local branch=$2
  local commit=$3
  
  curl -X POST "\\$API_BASE/test-results" \\
    -H "Authorization: Bearer \\$API_TOKEN" \\
    -H "Content-Type: application/json" \\
    -d "{
      \"projectId\": \"\\$PROJECT_ID\",
      \"testSuiteName\": \"CI Pipeline\",
      \"branch\": \"\\$branch\",
      \"commit\": \"\\$commit\",
      \"buildNumber\": \"\\$BUILD_NUMBER\",
      \"tests\": [
        {
          \"name\": \"unit_tests\",
          \"status\": \"\\$status\",
          \"duration\": 2500
        }
      ]
    }"
}

# Function to get flaky test analysis
get_flaky_analysis() {
  curl -X GET "\\$API_BASE/flaky-analysis?projectId=\\$PROJECT_ID" \\
    -H "Authorization: Bearer \\$API_TOKEN" \\
    | jq '.flakyTests[] | select(.flakyScore > 0.7)'
}

submit_test_results "passed" "main" "abc123"
get_flaky_analysis`,

      javascript: `// Complete Flaky Test Detector Integration
const axios = require('axios');

class FlakyTestDetector {
  constructor(apiToken, projectId) {
    this.client = axios.create({
      baseURL: '${apiBaseUrl}',
      headers: {
        'Authorization': \`Bearer \${apiToken}\`,
        'Content-Type': 'application/json'
      }
    });
    this.projectId = projectId;
  }

  async submitTestResults(testResults) {
    try {
      const response = await this.client.post('/test-results', {
        projectId: this.projectId,
        testSuiteName: testResults.suiteName || 'Test Suite',
        branch: testResults.branch || 'main',
        commit: testResults.commit,
        buildNumber: testResults.buildNumber,
        timestamp: new Date().toISOString(),
        tests: testResults.tests
      });
      
      console.log('Test results submitted:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to submit test results:', error.response?.data || error.message);
      throw error;
    }
  }

  async getFlakyAnalysis(options = {}) {
    try {
      const response = await this.client.get('/flaky-analysis', {
        params: {
          projectId: this.projectId,
          branch: options.branch,
          days: options.days || 30
        }
      });
      
      console.log('Flaky test analysis:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to get flaky analysis:', error.response?.data || error.message);
      throw error;
    }
  }

  async checkForFlakyTests() {
    const analysis = await this.getFlakyAnalysis();
    const flakyTests = analysis.flakyTests.filter(test => test.flakyScore > 0.7);
    
    if (flakyTests.length > 0) {
      console.warn(\`\${flakyTests.length} flaky tests detected:\`);
      flakyTests.forEach(test => {
        console.warn(\`- \${test.testName} (score: \${test.flakyScore})\`);
      });
    }
    
    return flakyTests;
  }
}

// Usage
const detector = new FlakyTestDetector('YOUR_API_TOKEN', '${projectId || 'your-project-id'}');

// Submit test results
detector.submitTestResults({
  suiteName: 'Unit Tests',
  branch: 'main',
  commit: 'abc123',
  buildNumber: '42',
  tests: [
    { name: 'test_login', status: 'passed', duration: 150 },
    { name: 'test_database', status: 'failed', duration: 5000, errorMessage: 'Timeout' }
  ]
});

// Check for flaky tests
detector.checkForFlakyTests();`,

      python: `# Complete Flaky Test Detector Integration
import requests
import json
from datetime import datetime
from typing import List, Dict, Optional

class FlakyTestDetector:
    def __init__(self, api_token: str, project_id: str):
        self.base_url = '${apiBaseUrl}'
        self.project_id = project_id
        self.headers = {
            'Authorization': f'Bearer {api_token}',
            'Content-Type': 'application/json'
        }
    
    def submit_test_results(self, test_results: Dict) -> Dict:
        """Submit test results for analysis"""
        payload = {
            'projectId': self.project_id,
            'testSuiteName': test_results.get('suite_name', 'Test Suite'),
            'branch': test_results.get('branch', 'main'),
            'commit': test_results['commit'],
            'buildNumber': test_results.get('build_number'),
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'tests': test_results['tests']
        }
        
        try:
            response = requests.post(
                f'{self.base_url}/test-results',
                headers=self.headers,
                json=payload
            )
            response.raise_for_status()
            
            result = response.json()
            print(f'Test results submitted: {result}')
            return result
            
        except requests.exceptions.RequestException as e:
            print(f'Failed to submit test results: {e}')
            if hasattr(e, 'response') and e.response is not None:
                print(f'Response: {e.response.text}')
            raise
    
    def get_flaky_analysis(self, branch: Optional[str] = None, days: int = 30) -> Dict:
        """Get flaky test analysis"""
        params = {
            'projectId': self.project_id,
            'days': days
        }
        if branch:
            params['branch'] = branch
        
        try:
            response = requests.get(
                f'{self.base_url}/flaky-analysis',
                headers=self.headers,
                params=params
            )
            response.raise_for_status()
            
            result = response.json()
            print(f'Flaky test analysis retrieved: {len(result.get("flakyTests", []))} tests analyzed')
            return result
            
        except requests.exceptions.RequestException as e:
            print(f'Failed to get flaky analysis: {e}')
            raise
    
    def check_for_flaky_tests(self, threshold: float = 0.7) -> List[Dict]:
        """Check for tests exceeding flakiness threshold"""
        analysis = self.get_flaky_analysis()
        flaky_tests = [
            test for test in analysis.get('flakyTests', [])
            if test['flakyScore'] > threshold
        ]
        
        if flaky_tests:
            print(f'WARNING: {len(flaky_tests)} flaky tests detected:')
            for test in flaky_tests:
                print(f'  - {test["testName"]} (score: {test["flakyScore"]:.2f})')
        else:
            print('No highly flaky tests detected')
        
        return flaky_tests

# Usage example
if __name__ == '__main__':
    detector = FlakyTestDetector('YOUR_API_TOKEN', '${projectId || 'your-project-id'}')
    
    # Submit test results
    test_results = {
        'suite_name': 'Unit Tests',
        'branch': 'main',
        'commit': 'abc123',
        'build_number': '42',
        'tests': [
            {'name': 'test_login', 'status': 'passed', 'duration': 150},
            {'name': 'test_database', 'status': 'failed', 'duration': 5000, 
             'errorMessage': 'Connection timeout'}
        ]
    }
    
    detector.submit_test_results(test_results)
    
    # Check for flaky tests
    detector.check_for_flaky_tests()`,

      go: `// Complete Flaky Test Detector Integration
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "net/url"
    "time"
)

type FlakyTestDetector struct {
    BaseURL   string
    ProjectID string
    APIToken  string
    Client    *http.Client
}

type TestResult struct {
    Name         string \`json:"name"\`
    Status       string \`json:"status"\`
    Duration     int    \`json:"duration,omitempty"\`
    ErrorMessage string \`json:"errorMessage,omitempty"\`
}

type TestSubmission struct {
    ProjectID     string       \`json:"projectId"\`
    TestSuiteName string       \`json:"testSuiteName"\`
    Branch        string       \`json:"branch"\`
    Commit        string       \`json:"commit"\`
    BuildNumber   string       \`json:"buildNumber,omitempty"\`
    Timestamp     string       \`json:"timestamp"\`
    Tests         []TestResult \`json:"tests"\`
}

type FlakyTest struct {
    TestName     string  \`json:"testName"\`
    FlakyScore   float64 \`json:"flakyScore"\`
    FailureRate  float64 \`json:"failureRate"\`
    TotalRuns    int     \`json:"totalRuns"\`
    Failures     int     \`json:"failures"\`
}

type FlakyAnalysis struct {
    FlakyTests []FlakyTest \`json:"flakyTests"\`
}

func NewFlakyTestDetector(apiToken, projectID string) *FlakyTestDetector {
    return &FlakyTestDetector{
        BaseURL:   "${apiBaseUrl}",
        ProjectID: projectID,
        APIToken:  apiToken,
        Client:    &http.Client{Timeout: 30 * time.Second},
    }
}

func (f *FlakyTestDetector) SubmitTestResults(submission TestSubmission) error {
    submission.ProjectID = f.ProjectID
    submission.Timestamp = time.Now().UTC().Format(time.RFC3339)
    
    jsonData, err := json.Marshal(submission)
    if err != nil {
        return fmt.Errorf("failed to marshal test results: %w", err)
    }
    
    req, err := http.NewRequest("POST", f.BaseURL+"/test-results", bytes.NewBuffer(jsonData))
    if err != nil {
        return fmt.Errorf("failed to create request: %w", err)
    }
    
    req.Header.Set("Authorization", "Bearer "+f.APIToken)
    req.Header.Set("Content-Type", "application/json")
    
    resp, err := f.Client.Do(req)
    if err != nil {
        return fmt.Errorf("failed to submit test results: %w", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        body, _ := io.ReadAll(resp.Body)
        return fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
    }
    
    fmt.Println("Test results submitted successfully")
    return nil
}

func (f *FlakyTestDetector) GetFlakyAnalysis(branch string, days int) (*FlakyAnalysis, error) {
    params := url.Values{}
    params.Add("projectId", f.ProjectID)
    if branch != "" {
        params.Add("branch", branch)
    }
    if days > 0 {
        params.Add("days", fmt.Sprintf("%d", days))
    }
    
    req, err := http.NewRequest("GET", f.BaseURL+"/flaky-analysis?"+params.Encode(), nil)
    if err != nil {
        return nil, fmt.Errorf("failed to create request: %w", err)
    }
    
    req.Header.Set("Authorization", "Bearer "+f.APIToken)
    
    resp, err := f.Client.Do(req)
    if err != nil {
        return nil, fmt.Errorf("failed to get flaky analysis: %w", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        body, _ := io.ReadAll(resp.Body)
        return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
    }
    
    var analysis FlakyAnalysis
    if err := json.NewDecoder(resp.Body).Decode(&analysis); err != nil {
        return nil, fmt.Errorf("failed to decode response: %w", err)
    }
    
    return &analysis, nil
}

func (f *FlakyTestDetector) CheckForFlakyTests(threshold float64) ([]FlakyTest, error) {
    analysis, err := f.GetFlakyAnalysis("", 30)
    if err != nil {
        return nil, err
    }
    
    var flakyTests []FlakyTest
    for _, test := range analysis.FlakyTests {
        if test.FlakyScore > threshold {
            flakyTests = append(flakyTests, test)
        }
    }
    
    if len(flakyTests) > 0 {
        fmt.Printf("WARNING: %d flaky tests detected:\\n", len(flakyTests))
        for _, test := range flakyTests {
            fmt.Printf("  - %s (score: %.2f)\\n", test.TestName, test.FlakyScore)
        }
    } else {
        fmt.Println("No highly flaky tests detected")
    }
    
    return flakyTests, nil
}

func main() {
    detector := NewFlakyTestDetector("YOUR_API_TOKEN", "${projectId || 'your-project-id'}")
    
    // Submit test results
    submission := TestSubmission{
        TestSuiteName: "Unit Tests",
        Branch:        "main",
        Commit:        "abc123",
        BuildNumber:   "42",
        Tests: []TestResult{
            {Name: "test_login", Status: "passed", Duration: 150},
            {Name: "test_database", Status: "failed", Duration: 5000, ErrorMessage: "Connection timeout"},
        },
    }
    
    if err := detector.SubmitTestResults(submission); err != nil {
        fmt.Printf("Error submitting test results: %v\\n", err)
        return
    }
    
    // Check for flaky tests
    if _, err := detector.CheckForFlakyTests(0.7); err != nil {
        fmt.Printf("Error checking flaky tests: %v\\n", err)
    }
}`
    };
    
    return examples[selectedLanguage];
  };

  const getErrorHandlingExample = () => {
    const examples = {
      curl: `# Error Handling with cURL
submit_with_retry() {
  local max_retries=3
  local retry_count=0
  
  while [ \\$retry_count -lt \\$max_retries ]; do
    response=$(curl -s -w "%{http_code}" -X POST "\\$API_BASE/test-results" \\
      -H "Authorization: Bearer \\$API_TOKEN" \\
      -H "Content-Type: application/json" \\
      -d "$1")
    
    http_code=\${response: -3}
    
    if [ "\$http_code" -eq 200 ]; then
      echo "Success: Test results submitted"
      return 0
    elif [ "\$http_code" -eq 429 ]; then
      echo "Rate limited, retrying in 5 seconds..."
      sleep 5
    else
      echo "Error \$http_code: \${response%???}"
    fi
    
    retry_count=\$((retry_count + 1))
  done
  
  echo "Failed after \$max_retries attempts"
  return 1
}`,

      javascript: `// Error Handling with Retry Logic
class FlakyTestDetectorWithRetry extends FlakyTestDetector {
  async submitWithRetry(testResults, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.submitTestResults(testResults);
      } catch (error) {
        console.log(\`Attempt \${attempt} failed:\`, error.message);
        
        // Handle specific error types
        if (error.response?.status === 429) {
          // Rate limited - wait before retry
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(\`Rate limited, waiting \${delay}ms before retry...\`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else if (error.response?.status >= 500) {
          // Server error - retry
          console.log('Server error, retrying...');
        } else {
          // Client error - don't retry
          throw error;
        }
        
        if (attempt === maxRetries) {
          throw new Error(\`Failed after \${maxRetries} attempts: \${error.message}\`);
        }
      }
    }
  }
  
  async submitTestResultsSafely(testResults) {
    try {
      // Validate input
      if (!testResults.tests || testResults.tests.length === 0) {
        throw new Error('No test results provided');
      }
      
      // Submit with retry logic
      return await this.submitWithRetry(testResults);
    } catch (error) {
      console.error('Failed to submit test results:', error.message);
      
      // Log to monitoring service
      this.logError('test_submission_failed', error);
      
      // Return a safe fallback
      return { success: false, error: error.message };
    }
  }
  
  logError(event, error) {
    // Integration with monitoring service
    console.error(\`[\${event}] \${error.message}\`, {
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}`,

      python: `# Error Handling with Retry Logic
import time
import logging
from typing import Dict, Optional
from requests.exceptions import RequestException, HTTPError

class FlakyTestDetectorWithRetry(FlakyTestDetector):
    def __init__(self, api_token: str, project_id: str):
        super().__init__(api_token, project_id)
        self.logger = logging.getLogger(__name__)
    
    def submit_with_retry(self, test_results: Dict, max_retries: int = 3) -> Dict:
        """Submit test results with retry logic"""
        for attempt in range(1, max_retries + 1):
            try:
                return self.submit_test_results(test_results)
            except HTTPError as e:
                self.logger.warning(f'Attempt {attempt} failed: {e}')
                
                if e.response.status_code == 429:
                    # Rate limited - exponential backoff
                    delay = 2 ** attempt
                    self.logger.info(f'Rate limited, waiting {delay}s before retry...')
                    time.sleep(delay)
                elif e.response.status_code >= 500:
                    # Server error - retry
                    self.logger.info('Server error, retrying...')
                else:
                    # Client error - don't retry
                    raise
                
                if attempt == max_retries:
                    raise Exception(f'Failed after {max_retries} attempts: {e}')
            except RequestException as e:
                self.logger.error(f'Network error on attempt {attempt}: {e}')
                if attempt == max_retries:
                    raise
                time.sleep(2 ** attempt)
    
    def submit_test_results_safely(self, test_results: Dict) -> Dict:
        """Submit test results with comprehensive error handling"""
        try:
            # Validate input
            if not test_results.get('tests'):
                raise ValueError('No test results provided')
            
            # Sanitize test data
            sanitized_results = self._sanitize_test_results(test_results)
            
            # Submit with retry logic
            return self.submit_with_retry(sanitized_results)
            
        except Exception as e:
            self.logger.error(f'Failed to submit test results: {e}')
            
            # Log to monitoring service
            self._log_error('test_submission_failed', e)
            
            # Return safe fallback
            return {'success': False, 'error': str(e)}
    
    def _sanitize_test_results(self, test_results: Dict) -> Dict:
        """Sanitize and validate test results"""
        sanitized = test_results.copy()
        
        # Ensure required fields
        sanitized.setdefault('branch', 'main')
        sanitized.setdefault('suite_name', 'Test Suite')
        
        # Sanitize test data
        for test in sanitized.get('tests', []):
            if 'status' not in test:
                test['status'] = 'unknown'
            if test['status'] not in ['passed', 'failed', 'skipped']:
                test['status'] = 'failed'
        
        return sanitized
    
    def _log_error(self, event: str, error: Exception):
        """Log error to monitoring service"""
        self.logger.error(f'[{event}] {error}', extra={
            'event': event,
            'error_type': type(error).__name__,
            'timestamp': time.time()
        })`,

      go: `// Error Handling with Retry Logic
package main

import (
    "context"
    "fmt"
    "log"
    "math"
    "net/http"
    "time"
)

type RetryConfig struct {
    MaxRetries int
    BaseDelay  time.Duration
}

func (f *FlakyTestDetector) SubmitTestResultsWithRetry(ctx context.Context, submission TestSubmission, config RetryConfig) error {
    var lastErr error
    
    for attempt := 1; attempt <= config.MaxRetries; attempt++ {
        select {
        case <-ctx.Done():
            return ctx.Err()
        default:
        }
        
        err := f.SubmitTestResults(submission)
        if err == nil {
            return nil
        }
        
        lastErr = err
        log.Printf("Attempt %d failed: %v", attempt, err)
        
        // Check if we should retry
        if !f.shouldRetry(err) {
            return err
        }
        
        if attempt < config.MaxRetries {
            // Exponential backoff with jitter
            delay := time.Duration(math.Pow(2, float64(attempt))) * config.BaseDelay
            log.Printf("Retrying in %v...", delay)
            
            select {
            case <-time.After(delay):
            case <-ctx.Done():
                return ctx.Err()
            }
        }
    }
    
    return fmt.Errorf("failed after %d attempts: %w", config.MaxRetries, lastErr)
}

func (f *FlakyTestDetector) shouldRetry(err error) bool {
    // Check for retryable errors
    if httpErr, ok := err.(*http.Client); ok {
        // Retry on server errors and rate limits
        return httpErr.StatusCode >= 500 || httpErr.StatusCode == 429
    }
    
    // Retry on network errors
    return true
}

func (f *FlakyTestDetector) SubmitTestResultsSafely(ctx context.Context, submission TestSubmission) error {
    // Validate input
    if len(submission.Tests) == 0 {
        return fmt.Errorf("no test results provided")
    }
    
    // Sanitize test data
    f.sanitizeTestResults(&submission)
    
    // Submit with retry logic
    config := RetryConfig{
        MaxRetries: 3,
        BaseDelay:  time.Second,
    }
    
    err := f.SubmitTestResultsWithRetry(ctx, submission, config)
    if err != nil {
        log.Printf("Failed to submit test results: %v", err)
        f.logError("test_submission_failed", err)
        return err
    }
    
    return nil
}

func (f *FlakyTestDetector) sanitizeTestResults(submission *TestSubmission) {
    // Ensure required fields
    if submission.Branch == "" {
        submission.Branch = "main"
    }
    if submission.TestSuiteName == "" {
        submission.TestSuiteName = "Test Suite"
    }
    
    // Sanitize test data
    for i := range submission.Tests {
        test := &submission.Tests[i]
        if test.Status == "" {
            test.Status = "unknown"
        }
        
        // Validate status values
        switch test.Status {
        case "passed", "failed", "skipped":
            // Valid status
        default:
            test.Status = "failed"
        }
    }
}

func (f *FlakyTestDetector) logError(event string, err error) {
    log.Printf("[%s] %v", event, err)
    // Here you would integrate with your monitoring service
}`
    };
    
    return examples[selectedLanguage];
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return renderOverview();
      case 'quickstart':
        return renderQuickStart();
      case 'authentication':
        return renderAuthentication();
      case 'endpoints':
        return renderEndpoints();
      case 'webhooks':
        return renderWebhooks();
      case 'examples':
        return renderExamples();
      default:
        return renderOverview();
    }
  };

  return (
    <div className="bg-white">
      <div className="flex">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-gray-50 border-r border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">API Documentation</h3>
          <nav className="space-y-2">
            {navigation.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key as any)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                  activeSection === item.key
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
          
          {copySuccess && (
            <div className="mt-4 px-3 py-2 bg-green-100 text-green-800 text-xs rounded">
              {copySuccess}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default ApiDocumentation;