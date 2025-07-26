import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Calendar, Download, Filter, BarChart3, PieChart,
  Clock, Users, GitBranch, Activity, Target, Zap
} from 'lucide-react';

interface EnhancedAnalyticsDashboardProps {
  organizationId?: string;
}

interface AnalyticsMetric {
  id: string;
  title: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  icon: React.ComponentType<any>;
  color: string;
}

interface TimeSeriesData {
  date: string;
  flakyTests: number;
  totalTests: number;
  failureRate: number;
  avgDuration: number;
}

const EnhancedAnalyticsDashboard: React.FC<EnhancedAnalyticsDashboardProps> = ({ organizationId }) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [selectedProjects, setSelectedProjects] = useState<string[]>(['all']);
  const [isExporting, setIsExporting] = useState(false);
  const [metricsData, setMetricsData] = useState<AnalyticsMetric[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);

  // Mock data - in real implementation, this would come from API
  useEffect(() => {
    const generateMetrics = (): AnalyticsMetric[] => [
      {
        id: 'total-flaky-tests',
        title: 'Total Flaky Tests',
        value: 47,
        change: -12.5,
        trend: 'down',
        icon: AlertTriangle,
        color: 'text-red-600'
      },
      {
        id: 'test-reliability',
        title: 'Test Reliability',
        value: '94.2%',
        change: 3.1,
        trend: 'up',
        icon: CheckCircle,
        color: 'text-green-600'
      },
      {
        id: 'avg-fix-time',
        title: 'Avg Fix Time',
        value: '2.3h',
        change: -25.4,
        trend: 'down',
        icon: Clock,
        color: 'text-blue-600'
      },
      {
        id: 'pipeline-stability',
        title: 'Pipeline Stability',
        value: '87.8%',
        change: 5.2,
        trend: 'up',
        icon: Activity,
        color: 'text-purple-600'
      },
      {
        id: 'weekly-savings',
        title: 'Weekly Time Saved',
        value: '12.4h',
        change: 18.3,
        trend: 'up',
        icon: TrendingUp,
        color: 'text-emerald-600'
      },
      {
        id: 'active-projects',
        title: 'Active Projects',
        value: 8,
        change: 2,
        trend: 'up',
        icon: GitBranch,
        color: 'text-indigo-600'
      }
    ];

    const generateTimeSeriesData = (): TimeSeriesData[] => {
      const data: TimeSeriesData[] = [];
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
      
      for (let i = days; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        data.push({
          date: date.toISOString().split('T')[0],
          flakyTests: Math.floor(Math.random() * 50) + 10,
          totalTests: Math.floor(Math.random() * 500) + 200,
          failureRate: Math.random() * 0.1,
          avgDuration: Math.floor(Math.random() * 300) + 100
        });
      }
      
      return data;
    };

    setMetricsData(generateMetrics());
    setTimeSeriesData(generateTimeSeriesData());
  }, [timeRange]);

  const handleExport = async (format: 'csv' | 'pdf' | 'json') => {
    setIsExporting(true);
    
    // Simulate export process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const data = {
      metrics: metricsData,
      timeSeries: timeSeriesData,
      exportDate: new Date().toISOString(),
      timeRange,
      selectedProjects
    };

    if (format === 'json') {
      const dataStr = JSON.stringify(data, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const exportFileDefaultName = `flaky-test-analytics-${timeRange}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } else if (format === 'csv') {
      const csvData = timeSeriesData.map(item => 
        `${item.date},${item.flakyTests},${item.totalTests},${item.failureRate.toFixed(3)},${item.avgDuration}`
      ).join('\n');
      
      const csvContent = `Date,Flaky Tests,Total Tests,Failure Rate,Avg Duration\n${csvData}`;
      const dataUri = 'data:text/csv;charset=utf-8,'+ encodeURIComponent(csvContent);
      const exportFileDefaultName = `flaky-test-analytics-${timeRange}.csv`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    }

    setIsExporting(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Enhanced Analytics</h1>
          <p className="text-gray-600 mt-1">Comprehensive insights into your test reliability</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Time Range Selector */}
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
          </div>

          {/* Export Button */}
          <div className="relative">
            <button
              onClick={() => document.getElementById('export-menu')?.classList.toggle('hidden')}
              disabled={isExporting}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </>
              )}
            </button>
            
            <div id="export-menu" className="hidden absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-10">
              <button
                onClick={() => handleExport('csv')}
                className="block w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
              >
                Export as CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                className="block w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
              >
                Export as JSON
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="block w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
              >
                Export as PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {metricsData.map((metric, index) => (
          <motion.div
            key={metric.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg bg-opacity-10 ${metric.color.replace('text-', 'bg-')}`}>
                <metric.icon className={`w-5 h-5 ${metric.color}`} />
              </div>
              <div className={`flex items-center text-sm font-medium ${
                metric.trend === 'up' ? 'text-green-600' : 
                metric.trend === 'down' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {metric.trend === 'up' ? (
                  <TrendingUp className="w-4 h-4 mr-1" />
                ) : metric.trend === 'down' ? (
                  <TrendingDown className="w-4 h-4 mr-1" />
                ) : null}
                {metric.change > 0 ? '+' : ''}{metric.change}%
              </div>
            </div>
            
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {metric.value}
              </h3>
              <p className="text-sm text-gray-600">
                {metric.title}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Flaky Test Trends */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Flaky Test Trends</h3>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="h-64 flex items-end justify-between space-x-2">
            {timeSeriesData.slice(-7).map((data, index) => (
              <div key={data.date} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-gradient-to-t from-red-500 to-red-300 rounded-t"
                  style={{
                    height: `${(data.flakyTests / Math.max(...timeSeriesData.map(d => d.flakyTests))) * 200}px`
                  }}
                />
                <span className="text-xs text-gray-600 mt-2">
                  {new Date(data.date).getDate()}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Test Reliability Distribution */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Test Status Distribution</h3>
            <PieChart className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Stable Tests</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">87.3%</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Occasionally Flaky</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">8.9%</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Consistently Flaky</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">3.8%</span>
            </div>
          </div>
          
          <div className="mt-6 relative">
            <div className="flex h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="bg-green-500" style={{ width: '87.3%' }}></div>
              <div className="bg-yellow-500" style={{ width: '8.9%' }}></div>
              <div className="bg-red-500" style={{ width: '3.8%' }}></div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Detailed Analytics Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200"
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Project Performance</h3>
            <Filter className="w-5 h-5 text-gray-400" />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tests
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Flaky
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reliability
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trend
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[
                { name: 'Web App', tests: 324, flaky: 12, reliability: 96.3, trend: 'up' },
                { name: 'API Service', tests: 156, flaky: 8, reliability: 94.9, trend: 'stable' },
                { name: 'Mobile App', tests: 89, flaky: 15, reliability: 83.1, trend: 'down' },
                { name: 'Data Pipeline', tests: 67, flaky: 3, reliability: 95.5, trend: 'up' },
              ].map((project, index) => (
                <tr key={project.name} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Target className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900">{project.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {project.tests}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {project.flaky}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      project.reliability >= 95 ? 'bg-green-100 text-green-800' :
                      project.reliability >= 90 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {project.reliability}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {project.trend === 'up' ? (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : project.trend === 'down' ? (
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    ) : (
                      <div className="w-4 h-4 bg-gray-300 rounded-full"></div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-indigo-600 hover:text-indigo-900">
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* AI Insights Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-6"
      >
        <div className="flex items-center mb-4">
          <Zap className="w-6 h-6 text-purple-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">AI-Powered Insights</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 border border-purple-100">
            <h4 className="font-medium text-gray-900 mb-2">🎯 Top Recommendation</h4>
            <p className="text-sm text-gray-600">
              Focus on the Mobile App project - it has 15 flaky tests affecting 83% reliability. 
              Address network timeout issues first.
            </p>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-purple-100">
            <h4 className="font-medium text-gray-900 mb-2">📈 Performance Trend</h4>
            <p className="text-sm text-gray-600">
              Overall test reliability improved by 3.1% this month. Web App and Data Pipeline 
              are leading contributors to this improvement.
            </p>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-purple-100">
            <h4 className="font-medium text-gray-900 mb-2">⚡ Quick Win</h4>
            <p className="text-sm text-gray-600">
              Enable auto-retry for 8 specific tests in API Service to increase reliability 
              from 94.9% to 97.2% instantly.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default EnhancedAnalyticsDashboard;