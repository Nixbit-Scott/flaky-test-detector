import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Download, Calendar, Filter, Send, Users,
  Clock, TrendingUp, AlertTriangle, CheckCircle, 
  Mail, Slack, Webhook, Settings, Play, Pause,
  BarChart3, FileSpreadsheet, FileImage, FileCode
} from 'lucide-react';

interface ReportingSystemProps {
  organizationId?: string;
}

interface Report {
  id: string;
  name: string;
  type: 'executive' | 'technical' | 'team' | 'compliance';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  recipients: string[];
  lastGenerated: Date;
  status: 'active' | 'paused' | 'draft';
  format: 'pdf' | 'html' | 'csv' | 'json';
  description: string;
}

interface NotificationChannel {
  id: string;
  type: 'email' | 'slack' | 'webhook' | 'teams';
  name: string;
  configured: boolean;
  enabled: boolean;
}

const ReportingSystem: React.FC<ReportingSystemProps> = ({ organizationId }) => {
  const [activeTab, setActiveTab] = useState<'reports' | 'notifications' | 'templates' | 'settings'>('reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>([]);
  const [isGeneratingReport, setIsGeneratingReport] = useState<string | null>(null);
  const [showCreateReport, setShowCreateReport] = useState(false);

  // Mock data initialization
  useEffect(() => {
    const mockReports: Report[] = [
      {
        id: '1',
        name: 'Weekly Executive Summary',
        type: 'executive',
        frequency: 'weekly',
        recipients: ['ceo@company.com', 'cto@company.com'],
        lastGenerated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        status: 'active',
        format: 'pdf',
        description: 'High-level overview of test reliability metrics and trends'
      },
      {
        id: '2',
        name: 'Daily Team Standup Report',
        type: 'team',
        frequency: 'daily',
        recipients: ['dev-team@company.com'],
        lastGenerated: new Date(Date.now() - 24 * 60 * 60 * 1000),
        status: 'active',
        format: 'html',
        description: 'Quick overview of overnight test failures and flaky test alerts'
      },
      {
        id: '3',
        name: 'Monthly Compliance Report',
        type: 'compliance',
        frequency: 'monthly',
        recipients: ['compliance@company.com', 'audit@company.com'],
        lastGenerated: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        status: 'active',
        format: 'pdf',
        description: 'Detailed compliance metrics and test coverage reports'
      },
      {
        id: '4',
        name: 'Technical Deep Dive',
        type: 'technical',
        frequency: 'weekly',
        recipients: ['devops@company.com', 'qa@company.com'],
        lastGenerated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        status: 'paused',
        format: 'json',
        description: 'Comprehensive technical analysis with raw data and metrics'
      }
    ];

    const mockChannels: NotificationChannel[] = [
      { id: '1', type: 'email', name: 'Email Notifications', configured: true, enabled: true },
      { id: '2', type: 'slack', name: 'Slack #alerts', configured: true, enabled: true },
      { id: '3', type: 'webhook', name: 'Custom Webhook', configured: false, enabled: false },
      { id: '4', type: 'teams', name: 'Microsoft Teams', configured: false, enabled: false }
    ];

    setReports(mockReports);
    setNotificationChannels(mockChannels);
  }, []);

  const handleGenerateReport = async (reportId: string) => {
    setIsGeneratingReport(reportId);
    
    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Update last generated time
    setReports(prev => prev.map(report => 
      report.id === reportId 
        ? { ...report, lastGenerated: new Date() }
        : report
    ));
    
    setIsGeneratingReport(null);
  };

  const handleToggleReportStatus = (reportId: string) => {
    setReports(prev => prev.map(report => 
      report.id === reportId 
        ? { ...report, status: report.status === 'active' ? 'paused' : 'active' }
        : report
    ));
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'executive': return TrendingUp;
      case 'technical': return BarChart3;
      case 'team': return Users;
      case 'compliance': return CheckCircle;
      default: return FileText;
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'pdf': return FileText;
      case 'csv': return FileSpreadsheet;
      case 'html': return FileImage;
      case 'json': return FileCode;
      default: return FileText;
    }
  };

  const renderReportsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Automated Reports</h3>
        <button
          onClick={() => setShowCreateReport(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <FileText className="w-4 h-4" />
          <span>Create Report</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {reports.map((report, index) => {
          const TypeIcon = getReportTypeIcon(report.type);
          const FormatIcon = getFormatIcon(report.format);
          
          return (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${
                    report.status === 'active' ? 'bg-green-100' : 
                    report.status === 'paused' ? 'bg-yellow-100' : 'bg-gray-100'
                  }`}>
                    <TypeIcon className={`w-5 h-5 ${
                      report.status === 'active' ? 'text-green-600' : 
                      report.status === 'paused' ? 'text-yellow-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{report.name}</h4>
                    <p className="text-sm text-gray-600 capitalize">{report.type} • {report.frequency}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleToggleReportStatus(report.id)}
                    className={`p-1 rounded ${
                      report.status === 'active' ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    {report.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <FormatIcon className="w-4 h-4 text-gray-400" />
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4">{report.description}</p>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Recipients:</span>
                  <span className="text-gray-900">{report.recipients.length} people</span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Last generated:</span>
                  <span className="text-gray-900">
                    {report.lastGenerated.toLocaleDateString()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Status:</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    report.status === 'active' ? 'bg-green-100 text-green-800' :
                    report.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {report.status === 'active' ? 'Active' : 
                     report.status === 'paused' ? 'Paused' : 'Draft'}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex space-x-3">
                <button
                  onClick={() => handleGenerateReport(report.id)}
                  disabled={isGeneratingReport === report.id}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
                >
                  {isGeneratingReport === report.id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Generate Now</span>
                    </>
                  )}
                </button>
                
                <button className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Notification Channels</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {notificationChannels.map((channel, index) => {
          const getChannelIcon = () => {
            switch (channel.type) {
              case 'email': return Mail;
              case 'slack': return Slack;
              case 'webhook': return Webhook;
              case 'teams': return Users;
              default: return Mail;
            }
          };
          
          const ChannelIcon = getChannelIcon();
          
          return (
            <motion.div
              key={channel.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white border border-gray-200 rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${
                    channel.configured ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    <ChannelIcon className={`w-5 h-5 ${
                      channel.configured ? 'text-green-600' : 'text-gray-400'
                    }`} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{channel.name}</h4>
                    <p className="text-sm text-gray-600 capitalize">{channel.type}</p>
                  </div>
                </div>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={channel.enabled}
                    disabled={!channel.configured}
                    onChange={(e) => {
                      setNotificationChannels(prev => prev.map(c => 
                        c.id === channel.id ? { ...c, enabled: e.target.checked } : c
                      ));
                    }}
                    className="sr-only"
                  />
                  <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    channel.enabled && channel.configured ? 'bg-indigo-600' : 'bg-gray-200'
                  } ${!channel.configured ? 'opacity-50' : ''}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      channel.enabled && channel.configured ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </div>
                </label>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Status:</span>
                  <span className={`font-medium ${
                    channel.configured ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {channel.configured ? 'Configured' : 'Not configured'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-500">Active:</span>
                  <span className={`font-medium ${
                    channel.enabled ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {channel.enabled ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              
              <div className="mt-4 flex space-x-3">
                <button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">
                  {channel.configured ? 'Configure' : 'Setup'}
                </button>
                
                {channel.configured && (
                  <button className="px-4 py-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg flex items-center space-x-1">
                    <Send className="w-4 h-4" />
                    <span>Test</span>
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  const renderTemplatesTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Report Templates</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          {
            name: 'Executive Summary',
            description: 'High-level metrics and trends for leadership',
            icon: TrendingUp,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100'
          },
          {
            name: 'Technical Report',
            description: 'Detailed technical analysis and recommendations',
            icon: BarChart3,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100'
          },
          {
            name: 'Team Dashboard',
            description: 'Team-focused metrics and daily updates',
            icon: Users,
            color: 'text-green-600',
            bgColor: 'bg-green-100'
          },
          {
            name: 'Compliance Report',
            description: 'Compliance and audit-ready documentation',
            icon: CheckCircle,
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-100'
          },
          {
            name: 'Alert Summary',
            description: 'Critical alerts and incident summaries',
            icon: AlertTriangle,
            color: 'text-red-600',
            bgColor: 'bg-red-100'
          },
          {
            name: 'Custom Template',
            description: 'Create your own custom report template',
            icon: FileText,
            color: 'text-gray-600',
            bgColor: 'bg-gray-100'
          }
        ].map((template, index) => (
          <motion.div
            key={template.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className={`inline-flex p-3 rounded-lg ${template.bgColor} mb-4`}>
              <template.icon className={`w-6 h-6 ${template.color}`} />
            </div>
            
            <h4 className="font-semibold text-gray-900 mb-2">{template.name}</h4>
            <p className="text-sm text-gray-600 mb-4">{template.description}</p>
            
            <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">
              Use Template
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reporting System</h1>
          <p className="text-gray-600 mt-1">Automated reports and notifications for your team</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'reports', label: 'Reports', icon: FileText },
            { key: 'notifications', label: 'Notifications', icon: Send },
            { key: 'templates', label: 'Templates', icon: FileCode },
            { key: 'settings', label: 'Settings', icon: Settings }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'reports' && renderReportsTab()}
        {activeTab === 'notifications' && renderNotificationsTab()}
        {activeTab === 'templates' && renderTemplatesTab()}
        {activeTab === 'settings' && (
          <div className="text-center py-12">
            <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Settings Coming Soon</h3>
            <p className="text-gray-600">Advanced reporting settings and configurations will be available here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportingSystem;