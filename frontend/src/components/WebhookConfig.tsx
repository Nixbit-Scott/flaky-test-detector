import React, { useState } from 'react';

interface WebhookConfigProps {
  projectId: string;
}

const WebhookConfig: React.FC<WebhookConfigProps> = ({ projectId: _projectId }) => {
  const [selectedCI, setSelectedCI] = useState<'github' | 'gitlab' | 'jenkins' | 'generic'>('github');
  const [copySuccess, setCopySuccess] = useState('');

  const baseUrl = window.location.origin;
  const webhookUrls = {
    github: `${baseUrl}/.netlify/functions/webhook-github`,
    gitlab: `${baseUrl}/.netlify/functions/webhook-gitlab`,
    jenkins: `${baseUrl}/.netlify/functions/webhook-jenkins`,
    generic: `${baseUrl}/.netlify/functions/webhook-generic`,
  };

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

  const renderGitHubInstructions = () => (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900">GitHub Actions Setup</h4>
      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-sm text-gray-700 mb-3">
          1. Go to your repository → Settings → Webhooks → Add webhook
        </p>
        <div className="flex items-center space-x-2 mb-3">
          <span className="text-sm font-medium text-gray-700">Payload URL:</span>
          <code className="bg-white px-2 py-1 rounded border text-sm flex-1">{webhookUrls.github}</code>
          <button
            onClick={() => copyToClipboard(webhookUrls.github)}
            className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Copy
          </button>
        </div>
        <p className="text-sm text-gray-700 mb-2">
          2. Content type: <code className="bg-white px-1 rounded">application/json</code>
        </p>
        <p className="text-sm text-gray-700 mb-2">
          3. Select events: <strong>Workflow runs</strong> and <strong>Check runs</strong>
        </p>
        <p className="text-sm text-gray-700 mb-4">
          4. Set as Active and click "Add webhook"
        </p>
        
        <div className="mt-4 p-3 bg-blue-50 rounded border-l-4 border-blue-400">
          <h5 className="font-medium text-blue-900 mb-2">Optional: Enhanced Integration</h5>
          <p className="text-sm text-blue-800 mb-2">
            For better test result extraction, add this step to your GitHub Actions workflow:
          </p>
          <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
{`- name: Report Test Results
  if: always()
  run: |
    curl -X POST ${webhookUrls.github} \\
      -H "Content-Type: application/json" \\
      -d '{
        "projectId": "your-project-id",
        "buildStatus": "${{ job.status }}",
        "branch": "${{ github.ref_name }}",
        "commit": "${{ github.sha }}",
        "testResults": {
          "testSuiteName": "CI Tests",
          "tests": [...]
        }
      }'`}
          </pre>
        </div>
      </div>
    </div>
  );

  const renderGitLabInstructions = () => (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900">GitLab CI Setup</h4>
      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-sm text-gray-700 mb-3">
          1. Go to your project → Settings → Webhooks
        </p>
        <div className="flex items-center space-x-2 mb-3">
          <span className="text-sm font-medium text-gray-700">URL:</span>
          <code className="bg-white px-2 py-1 rounded border text-sm flex-1">{webhookUrls.gitlab}</code>
          <button
            onClick={() => copyToClipboard(webhookUrls.gitlab)}
            className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Copy
          </button>
        </div>
        <p className="text-sm text-gray-700 mb-2">
          2. Trigger: <strong>Pipeline events</strong> and <strong>Job events</strong>
        </p>
        <p className="text-sm text-gray-700 mb-2">
          3. SSL verification: Enable (recommended)
        </p>
        <p className="text-sm text-gray-700 mb-4">
          4. Add webhook
        </p>
        
        <div className="mt-4 p-3 bg-orange-50 rounded border-l-4 border-orange-400">
          <h5 className="font-medium text-orange-900 mb-2">Optional: Enhanced Integration</h5>
          <p className="text-sm text-orange-800 mb-2">
            Add this to your .gitlab-ci.yml for better test result reporting:
          </p>
          <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
{`after_script:
  - |
    curl -X POST ${webhookUrls.gitlab} \\
      -H "Content-Type: application/json" \\
      -d '{
        "projectId": "your-project-id",
        "buildStatus": "'$CI_JOB_STATUS'",
        "branch": "'$CI_COMMIT_REF_NAME'",
        "commit": "'$CI_COMMIT_SHA'",
        "buildNumber": "'$CI_PIPELINE_ID'",
        "testResults": {...}
      }'`}
          </pre>
        </div>
      </div>
    </div>
  );

  const renderJenkinsInstructions = () => (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900">Jenkins Setup</h4>
      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-sm text-gray-700 mb-3">
          1. Install the "Notification Plugin" or "Generic Webhook Trigger Plugin"
        </p>
        <p className="text-sm text-gray-700 mb-3">
          2. In your job configuration → Post-build Actions → HTTP Request
        </p>
        <div className="flex items-center space-x-2 mb-3">
          <span className="text-sm font-medium text-gray-700">URL:</span>
          <code className="bg-white px-2 py-1 rounded border text-sm flex-1">{webhookUrls.jenkins}</code>
          <button
            onClick={() => copyToClipboard(webhookUrls.jenkins)}
            className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Copy
          </button>
        </div>
        <p className="text-sm text-gray-700 mb-2">
          3. HTTP Mode: <strong>POST</strong>
        </p>
        <p className="text-sm text-gray-700 mb-4">
          4. Content Type: <strong>application/json</strong>
        </p>
        
        <div className="mt-4 p-3 bg-red-50 rounded border-l-4 border-red-400">
          <h5 className="font-medium text-red-900 mb-2">Sample Request Body</h5>
          <p className="text-sm text-red-800 mb-2">
            Configure the request body with this JSON structure:
          </p>
          <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
{`{
  "jobName": "$JOB_NAME",
  "buildNumber": $BUILD_NUMBER,
  "buildStatus": "$BUILD_STATUS",
  "buildUrl": "$BUILD_URL",
  "gitBranch": "$GIT_BRANCH",
  "gitCommit": "$GIT_COMMIT",
  "testResults": {
    "totalCount": 10,
    "failCount": 0,
    "passCount": 10
  }
}`}
          </pre>
        </div>
      </div>
    </div>
  );

  const renderGenericInstructions = () => (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900">Generic Webhook Setup</h4>
      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-sm text-gray-700 mb-3">
          Use this endpoint for any CI/CD system (CircleCI, Travis CI, Azure DevOps, etc.)
        </p>
        <div className="flex items-center space-x-2 mb-4">
          <span className="text-sm font-medium text-gray-700">Webhook URL:</span>
          <code className="bg-white px-2 py-1 rounded border text-sm flex-1">{webhookUrls.generic}</code>
          <button
            onClick={() => copyToClipboard(webhookUrls.generic)}
            className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Copy
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="p-3 bg-green-50 rounded border-l-4 border-green-400">
            <h5 className="font-medium text-green-900 mb-2">Flexible JSON Format</h5>
            <p className="text-sm text-green-800 mb-2">
              Send a POST request with any of these formats:
            </p>
            <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
{`// Comprehensive format
{
  "projectId": "your-project-id",
  "buildStatus": "success|failure|error",
  "branch": "main",
  "commit": "abc123",
  "buildNumber": "42",
  "testResults": {
    "testSuiteName": "My Tests",
    "tests": [
      {
        "name": "test_login",
        "status": "passed",
        "duration": 150,
        "errorMessage": "Optional error message"
      }
    ]
  }
}`}
            </pre>
          </div>
          
          <div className="p-3 bg-yellow-50 rounded border-l-4 border-yellow-400">
            <h5 className="font-medium text-yellow-900 mb-2">Minimal Format</h5>
            <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
{`// Simple format - we'll generate mock test data
{
  "status": "success",
  "project": "my-project",
  "branch": "main",
  "commit": "abc123"
}`}
            </pre>
          </div>
          
          <div className="p-3 bg-purple-50 rounded border-l-4 border-purple-400">
            <h5 className="font-medium text-purple-900 mb-2">Headers (Optional)</h5>
            <p className="text-sm text-purple-800 mb-2">
              Include these headers for better categorization:
            </p>
            <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
{`X-CI-System: CircleCI
Content-Type: application/json`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">CI/CD Integration</h3>
        {copySuccess && (
          <span className="text-sm text-green-600 font-medium">{copySuccess}</span>
        )}
      </div>

      {/* CI/CD Platform Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Select your CI/CD platform:
        </label>
        <div className="flex space-x-4">
          <button
            onClick={() => setSelectedCI('github')}
            className={`flex items-center px-4 py-2 rounded-lg border ${
              selectedCI === 'github'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub Actions
          </button>
          
          <button
            onClick={() => setSelectedCI('gitlab')}
            className={`flex items-center px-4 py-2 rounded-lg border ${
              selectedCI === 'gitlab'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.955 13.587l-1.342-4.135-2.664-8.189c-.135-.423-.73-.423-.867 0L16.418 9.45H7.582L4.919 1.263c-.135-.423-.73-.423-.867 0L1.388 9.452.046 13.587c-.121.375.014.789.331 1.023L12 23.054l11.623-8.443c.318-.235.452-.648.332-1.024"/>
            </svg>
            GitLab CI
          </button>
          
          <button
            onClick={() => setSelectedCI('jenkins')}
            className={`flex items-center px-4 py-2 rounded-lg border ${
              selectedCI === 'jenkins'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Jenkins
          </button>
          
          <button
            onClick={() => setSelectedCI('generic')}
            className={`flex items-center px-4 py-2 rounded-lg border ${
              selectedCI === 'generic'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Other/Generic
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="border-t border-gray-200 pt-6">
        {selectedCI === 'github' && renderGitHubInstructions()}
        {selectedCI === 'gitlab' && renderGitLabInstructions()}
        {selectedCI === 'jenkins' && renderJenkinsInstructions()}
        {selectedCI === 'generic' && renderGenericInstructions()}
      </div>

      {/* Additional Info */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex">
          <svg className="w-5 h-5 text-blue-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-blue-800">Next Steps</h4>
            <p className="text-sm text-blue-700 mt-1">
              After setting up the webhook, run your tests to see results appear in the dashboard. 
              Test results will be automatically processed and flaky tests will be detected.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebhookConfig;