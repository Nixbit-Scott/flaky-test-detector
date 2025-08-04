import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bug, AlertTriangle, Camera, Upload, Send, X, 
  Clipboard, Check, RefreshCw, Monitor
} from 'lucide-react';
// import { useFeatureFlag } from '../hooks/useFeatureFlags';
import { useAuth } from '../contexts/AuthContext';

interface EnvironmentInfo {
  userAgent: string;
  viewport: { width: number; height: number };
  screen: { width: number; height: number };
  timezone: string;
  language: string;
  platform: string;
  cookieEnabled: boolean;
  onlineStatus: boolean;
  url: string;
  referrer: string;
  localStorage: string[];
  sessionStorage: string[];
  timestamp: string;
}

interface BugReport {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'ui' | 'functionality' | 'performance' | 'data' | 'other';
  reproductionSteps: string;
  expectedBehavior: string;
  actualBehavior: string;
  environment: EnvironmentInfo;
  screenshot?: File;
  consoleLog?: string;
  networkLog?: string;
  userId?: string;
  organizationId?: string;
}

const SEVERITY_COLORS = {
  low: 'text-green-600 bg-green-100 border-green-200',
  medium: 'text-yellow-600 bg-yellow-100 border-yellow-200',
  high: 'text-orange-600 bg-orange-100 border-orange-200',
  critical: 'text-red-600 bg-red-100 border-red-200',
};

const CATEGORY_ICONS = {
  ui: Monitor,
  functionality: Bug,
  performance: RefreshCw,
  data: AlertTriangle,
  other: AlertTriangle,
};

export const BugReportSystem: React.FC = () => {
  // const bugReportingEnabled = useFeatureFlag('bug_reporting');
  const bugReportingEnabled = true; // Temporarily hardcoded
  const { user } = useAuth();
  // const organization = user?.organization; // TODO: Fix organization access
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Bug report form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<BugReport['severity']>('medium');
  const [category, setCategory] = useState<BugReport['category']>('functionality');
  const [reproductionSteps, setReproductionSteps] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  
  // Environment capture
  const [environmentInfo, setEnvironmentInfo] = useState<EnvironmentInfo | null>(null);
  const [consoleLog, setConsoleLog] = useState<string>('');
  const [networkLog, setNetworkLog] = useState<string>('');

  useEffect(() => {
    if (bugReportingEnabled) {
      captureEnvironmentInfo();
      startConsoleCapture();
      startNetworkCapture();
    }
  }, [bugReportingEnabled]);

  const captureEnvironmentInfo = () => {
    const info: EnvironmentInfo = {
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      screen: {
        width: screen.width,
        height: screen.height,
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onlineStatus: navigator.onLine,
      url: window.location.href,
      referrer: document.referrer,
      localStorage: Object.keys(localStorage),
      sessionStorage: Object.keys(sessionStorage),
      timestamp: new Date().toISOString(),
    };

    setEnvironmentInfo(info);
  };

  const startConsoleCapture = () => {
    const logs: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
      logs.push(`[LOG] ${new Date().toISOString()}: ${args.join(' ')}`);
      originalLog.apply(console, args);
    };

    console.error = (...args) => {
      logs.push(`[ERROR] ${new Date().toISOString()}: ${args.join(' ')}`);
      originalError.apply(console, args);
    };

    console.warn = (...args) => {
      logs.push(`[WARN] ${new Date().toISOString()}: ${args.join(' ')}`);
      originalWarn.apply(console, args);
    };

    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      logs.push(`[UNHANDLED ERROR] ${new Date().toISOString()}: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`);
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      logs.push(`[UNHANDLED PROMISE REJECTION] ${new Date().toISOString()}: ${event.reason}`);
    });

    // Update console log periodically
    setInterval(() => {
      setConsoleLog(logs.slice(-50).join('\n')); // Keep last 50 entries
    }, 5000);
  };

  const startNetworkCapture = () => {
    const networkLogs: string[] = [];
    
    // Intercept fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const [url, options] = args;
      const startTime = Date.now();
      
      try {
        const response = await originalFetch(...args);
        const endTime = Date.now();
        networkLogs.push(`[FETCH] ${new Date().toISOString()}: ${options?.method || 'GET'} ${url} - ${response.status} (${endTime - startTime}ms)`);
        setNetworkLog(networkLogs.slice(-20).join('\n')); // Keep last 20 entries
        return response;
      } catch (error) {
        const endTime = Date.now();
        networkLogs.push(`[FETCH ERROR] ${new Date().toISOString()}: ${options?.method || 'GET'} ${url} - Failed (${endTime - startTime}ms): ${error}`);
        setNetworkLog(networkLogs.slice(-20).join('\n'));
        throw error;
      }
    };
  };

  const captureScreenshot = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      video.addEventListener('loadedmetadata', () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'bug-screenshot.png', { type: 'image/png' });
            setScreenshot(file);
          }
        }, 'image/png');

        // Stop all tracks to end screen sharing
        stream.getTracks().forEach(track => track.stop());
      });
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      setError('Failed to capture screenshot. Please try uploading an image manually.');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setScreenshot(file);
    } else {
      setError('Please upload a valid image file.');
    }
  };

  const handleSubmitBugReport = async () => {
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      
      const bugReport: BugReport = {
        title: title.trim(),
        description: description.trim(),
        severity,
        category,
        reproductionSteps: reproductionSteps.trim(),
        expectedBehavior: expectedBehavior.trim(),
        actualBehavior: actualBehavior.trim(),
        environment: environmentInfo!,
        consoleLog,
        networkLog,
        userId: user?.id,
        organizationId: 'default', // TODO: Fix organization access
      };

      formData.append('bugReport', JSON.stringify(bugReport));
      
      if (screenshot) {
        formData.append('screenshot', screenshot);
      }

      const response = await fetch('/.netlify/functions/bug-report', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to submit bug report');
      }

      setIsSubmitted(true);
      setTimeout(() => {
        handleClose();
        setIsSubmitted(false);
      }, 3000);

    } catch (err: any) {
      setError(err.message || 'Failed to submit bug report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setTitle('');
    setDescription('');
    setSeverity('medium');
    setCategory('functionality');
    setReproductionSteps('');
    setExpectedBehavior('');
    setActualBehavior('');
    setScreenshot(null);
    setError(null);
    setIsSubmitted(false);
  };

  const copyEnvironmentInfo = () => {
    if (environmentInfo) {
      const envText = JSON.stringify(environmentInfo, null, 2);
      navigator.clipboard.writeText(envText);
    }
  };

  if (!bugReportingEnabled) {
    return null;
  }

  return (
    <>
      {/* Floating Bug Report Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-6 bg-red-600 hover:bg-red-700 text-white p-3 rounded-full shadow-lg z-40"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.5 }}
      >
        <Bug className="h-6 w-6" />
      </motion.button>

      {/* Bug Report Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              {isSubmitted ? (
                <div className="p-8 text-center">
                  <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-medium text-gray-900 mb-2">
                    Bug Report Submitted!
                  </h3>
                  <p className="text-gray-500">
                    Thank you for helping us improve the beta experience. 
                    We'll investigate this issue and get back to you soon.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-6 border-b">
                    <div>
                      <h3 className="text-xl font-medium text-gray-900">
                        Report a Bug
                      </h3>
                      <p className="text-sm text-gray-500">
                        Help us improve by reporting bugs with detailed information
                      </p>
                    </div>
                    <button
                      onClick={handleClose}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Left Column - Bug Details */}
                      <div className="space-y-4">
                        {/* Title */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Bug Title *
                          </label>
                          <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                            placeholder="Brief description of the bug"
                          />
                        </div>

                        {/* Severity and Category */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Severity
                            </label>
                            <select
                              value={severity}
                              onChange={(e) => setSeverity(e.target.value as BugReport['severity'])}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="critical">Critical</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Category
                            </label>
                            <select
                              value={category}
                              onChange={(e) => setCategory(e.target.value as BugReport['category'])}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                            >
                              <option value="ui">UI/Design</option>
                              <option value="functionality">Functionality</option>
                              <option value="performance">Performance</option>
                              <option value="data">Data</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                        </div>

                        {/* Description */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description *
                          </label>
                          <textarea
                            rows={4}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                            placeholder="Detailed description of the bug"
                          />
                        </div>

                        {/* Steps to Reproduce */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Steps to Reproduce
                          </label>
                          <textarea
                            rows={3}
                            value={reproductionSteps}
                            onChange={(e) => setReproductionSteps(e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                            placeholder="1. Go to...\n2. Click on...\n3. See error"
                          />
                        </div>

                        {/* Expected vs Actual */}
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Expected Behavior
                            </label>
                            <textarea
                              rows={2}
                              value={expectedBehavior}
                              onChange={(e) => setExpectedBehavior(e.target.value)}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                              placeholder="What should happen?"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Actual Behavior
                            </label>
                            <textarea
                              rows={2}
                              value={actualBehavior}
                              onChange={(e) => setActualBehavior(e.target.value)}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                              placeholder="What actually happens?"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Right Column - Screenshots and Environment */}
                      <div className="space-y-4">
                        {/* Screenshot */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Screenshot
                          </label>
                          <div className="border-2 border-dashed border-gray-300 rounded-md p-4">
                            {screenshot ? (
                              <div className="text-center">
                                <img
                                  src={URL.createObjectURL(screenshot)}
                                  alt="Bug screenshot"
                                  className="max-w-full h-32 object-contain mx-auto mb-2"
                                />
                                <p className="text-sm text-gray-600">{screenshot.name}</p>
                                <button
                                  onClick={() => setScreenshot(null)}
                                  className="text-red-600 text-sm hover:underline"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="text-center">
                                <div className="flex justify-center space-x-4 mb-2">
                                  <button
                                    type="button"
                                    onClick={captureScreenshot}
                                    className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                                  >
                                    <Camera className="h-4 w-4" />
                                    <span>Capture Screen</span>
                                  </button>
                                  <label className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 cursor-pointer">
                                    <Upload className="h-4 w-4" />
                                    <span>Upload Image</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={handleFileUpload}
                                      className="hidden"
                                    />
                                  </label>
                                </div>
                                <p className="text-xs text-gray-500">
                                  Capture or upload a screenshot to help us understand the bug
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Environment Info */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                              Environment Information
                            </label>
                            <button
                              onClick={copyEnvironmentInfo}
                              className="text-xs text-blue-600 hover:underline flex items-center space-x-1"
                            >
                              <Clipboard className="h-3 w-3" />
                              <span>Copy</span>
                            </button>
                          </div>
                          <div className="bg-gray-50 rounded-md p-3 text-xs font-mono">
                            {environmentInfo && (
                              <div className="space-y-1">
                                <div><strong>Browser:</strong> {environmentInfo.userAgent.split(' ')[0]}</div>
                                <div><strong>Viewport:</strong> {environmentInfo.viewport.width}×{environmentInfo.viewport.height}</div>
                                <div><strong>URL:</strong> {environmentInfo.url}</div>
                                <div><strong>Time:</strong> {new Date(environmentInfo.timestamp).toLocaleString()}</div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Console Log Preview */}
                        {consoleLog && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Recent Console Output
                            </label>
                            <div className="bg-gray-900 text-green-400 rounded-md p-3 text-xs font-mono max-h-32 overflow-y-auto">
                              <pre>{consoleLog.split('\n').slice(-10).join('\n')}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-3">
                        <div className="text-sm text-red-700">{error}</div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
                    <button
                      onClick={handleClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitBugReport}
                      disabled={isSubmitting || !title.trim() || !description.trim()}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {isSubmitting ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      <span>{isSubmitting ? 'Submitting...' : 'Submit Bug Report'}</span>
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Helper function to trigger bug report from anywhere in the app
export const triggerBugReport = () => {
  window.dispatchEvent(new CustomEvent('open-bug-report'));
};

export default BugReportSystem;