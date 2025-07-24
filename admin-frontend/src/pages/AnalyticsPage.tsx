import React, { useState } from 'react';
import { useQuery } from 'react-query';
import {
  CurrencyDollarIcon,
  UsersIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  CalendarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PlayIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

import { adminService } from '../services/adminService';
import LoadingSpinner from '../components/LoadingSpinner';

interface AnalyticsData {
  revenue: {
    currentMRR: number;
    previousMRR: number;
    growth: number;
    trend: 'up' | 'down' | 'flat';
    byPlan: { [plan: string]: number };
    forecast: number;
  };
  customers: {
    total: number;
    active: number;
    churnRate: number;
    newSignups: number;
    retention: number;
    byPlan: { [plan: string]: number };
  };
  platform: {
    totalTestRuns: number;
    successRate: number;
    totalFlakyTests: number;
    uptime: number;
    avgResponseTime: number;
    totalProjects: number;
  };
  trends: {
    dates: string[];
    revenue: number[];
    customers: number[];
    testRuns: number[];
  };
}

const MetricCard: React.FC<{
  title: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'flat';
  icon: React.ComponentType<any>;
  color: string;
}> = ({ title, value, change, trend, icon: Icon, color }) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <ArrowUpIcon className="h-4 w-4 text-green-500" />;
      case 'down':
        return <ArrowDownIcon className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className={`flex-shrink-0 p-2 rounded-md ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
          </div>
        </div>
        {change && (
          <div className="flex items-center space-x-1">
            {getTrendIcon()}
            <span className={`text-sm font-medium ${getTrendColor()}`}>
              {change}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const SimpleChart: React.FC<{
  title: string;
  data: number[];
  labels: string[];
  color: string;
}> = ({ title, data, labels, color }) => {
  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue;

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="relative h-64">
        <div className="absolute inset-0 flex items-end justify-between space-x-1">
          {data.map((value, index) => {
            const height = range > 0 ? ((value - minValue) / range) * 100 : 50;
            return (
              <div key={index} className="flex flex-col items-center flex-1">
                <div 
                  className={`w-full rounded-t-sm ${color}`} 
                  style={{ height: `${Math.max(height, 5)}%` }}
                  title={`${labels[index]}: ${value}`}
                />
                <span className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-left whitespace-nowrap">
                  {labels[index]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const AnalyticsPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  // Mock analytics data - in real implementation this would come from the backend
  const { data: analyticsData, isLoading, error } = useQuery(
    ['analytics', timeRange],
    async (): Promise<AnalyticsData> => {
      // Simulate API call with mock data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockDates = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (29 - i));
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });

      return {
        revenue: {
          currentMRR: 24750,
          previousMRR: 22100,
          growth: 12.0,
          trend: 'up',
          byPlan: {
            starter: 8700,
            team: 9900,
            enterprise: 6150
          },
          forecast: 28500
        },
        customers: {
          total: 347,
          active: 329,
          churnRate: 2.8,
          newSignups: 23,
          retention: 94.2,
          byPlan: {
            starter: 198,
            team: 112,
            enterprise: 37
          }
        },
        platform: {
          totalTestRuns: 1247893,
          successRate: 94.7,
          totalFlakyTests: 2847,
          uptime: 99.8,
          avgResponseTime: 145,
          totalProjects: 892
        },
        trends: {
          dates: mockDates,
          revenue: Array.from({ length: 30 }, (_, i) => 
            20000 + Math.sin(i / 5) * 2000 + i * 150 + Math.random() * 1000
          ),
          customers: Array.from({ length: 30 }, (_, i) => 
            300 + Math.sin(i / 7) * 20 + i * 1.5 + Math.random() * 10
          ),
          testRuns: Array.from({ length: 30 }, (_, i) => 
            40000 + Math.sin(i / 3) * 5000 + Math.random() * 8000
          )
        }
      };
    },
    { staleTime: 5 * 60 * 1000 } // Cache for 5 minutes
  );

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        </div>
        <div className="card p-8 text-center">
          <h3 className="text-lg font-medium text-red-600 mb-2">Error Loading Analytics</h3>
          <p className="text-gray-600">Failed to load analytics data. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-2 text-gray-600">
            Advanced analytics, reporting, and business intelligence for your SaaS platform.
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="block px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : analyticsData ? (
        <>
          {/* Revenue Metrics */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <MetricCard
                title="Monthly Recurring Revenue"
                value={`$${analyticsData.revenue.currentMRR.toLocaleString()}`}
                change={`+${analyticsData.revenue.growth}%`}
                trend="up"
                icon={CurrencyDollarIcon}
                color="bg-green-500"
              />
              <MetricCard
                title="Revenue Forecast"
                value={`$${analyticsData.revenue.forecast.toLocaleString()}`}
                change="Next month"
                icon={TrendingUpIcon}
                color="bg-blue-500"
              />
              <MetricCard
                title="Plan Distribution"
                value={`${Object.keys(analyticsData.revenue.byPlan).length} Plans`}
                icon={ChartBarIcon}
                color="bg-purple-500"
              />
              <MetricCard
                title="Growth Rate"
                value={`${analyticsData.revenue.growth}%`}
                change="Month over month"
                trend="up"
                icon={TrendingUpIcon}
                color="bg-indigo-500"
              />
            </div>
          </div>

          {/* Customer Metrics */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <MetricCard
                title="Total Customers"
                value={analyticsData.customers.total.toString()}
                change={`+${analyticsData.customers.newSignups} this month`}
                trend="up"
                icon={UsersIcon}
                color="bg-blue-500"
              />
              <MetricCard
                title="Active Customers"
                value={analyticsData.customers.active.toString()}
                change={`${((analyticsData.customers.active / analyticsData.customers.total) * 100).toFixed(1)}% active`}
                icon={BuildingOfficeIcon}
                color="bg-green-500"
              />
              <MetricCard
                title="Churn Rate"
                value={`${analyticsData.customers.churnRate}%`}
                change="This month"
                trend="down"
                icon={TrendingDownIcon}
                color="bg-red-500"
              />
              <MetricCard
                title="Retention Rate"
                value={`${analyticsData.customers.retention}%`}
                change="Last 12 months"
                trend="up"
                icon={TrendingUpIcon}
                color="bg-green-500"
              />
            </div>
          </div>

          {/* Platform Metrics */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Platform Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <MetricCard
                title="Total Test Runs"
                value={analyticsData.platform.totalTestRuns.toLocaleString()}
                change="All time"
                icon={PlayIcon}
                color="bg-blue-500"
              />
              <MetricCard
                title="Success Rate"
                value={`${analyticsData.platform.successRate}%`}
                change="Last 30 days"
                trend="up"
                icon={ChartBarIcon}
                color="bg-green-500"
              />
              <MetricCard
                title="Active Flaky Tests"
                value={analyticsData.platform.totalFlakyTests.toLocaleString()}
                change="Currently monitored"
                icon={ExclamationTriangleIcon}
                color="bg-yellow-500"
              />
              <MetricCard
                title="System Uptime"
                value={`${analyticsData.platform.uptime}%`}
                change="Last 30 days"
                trend="up"
                icon={TrendingUpIcon}
                color="bg-green-500"
              />
            </div>
          </div>

          {/* Revenue by Plan Breakdown */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Breakdown</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Plan</h3>
                <div className="space-y-4">
                  {Object.entries(analyticsData.revenue.byPlan).map(([plan, revenue]) => {
                    const percentage = (revenue / analyticsData.revenue.currentMRR) * 100;
                    return (
                      <div key={plan}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-700 capitalize">{plan}</span>
                          <span className="text-sm text-gray-500">${revenue.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              plan === 'enterprise' ? 'bg-purple-600' :
                              plan === 'team' ? 'bg-blue-600' : 'bg-green-600'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{percentage.toFixed(1)}% of total</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Customers by Plan</h3>
                <div className="space-y-4">
                  {Object.entries(analyticsData.customers.byPlan).map(([plan, customers]) => {
                    const percentage = (customers / analyticsData.customers.total) * 100;
                    return (
                      <div key={plan}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-700 capitalize">{plan}</span>
                          <span className="text-sm text-gray-500">{customers} customers</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              plan === 'enterprise' ? 'bg-purple-600' :
                              plan === 'team' ? 'bg-blue-600' : 'bg-green-600'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{percentage.toFixed(1)}% of total</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Trend Charts */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Trends</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <SimpleChart
                title="Revenue Trend"
                data={analyticsData.trends.revenue}
                labels={analyticsData.trends.dates}
                color="bg-green-500"
              />
              <SimpleChart
                title="Customer Growth"
                data={analyticsData.trends.customers}
                labels={analyticsData.trends.dates}
                color="bg-blue-500"
              />
              <SimpleChart
                title="Test Run Volume"
                data={analyticsData.trends.testRuns}
                labels={analyticsData.trends.dates}
                color="bg-purple-500"
              />
            </div>
          </div>

          {/* Key Insights */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Revenue Health</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <ArrowUpIcon className="h-4 w-4 text-green-500 mr-2" />
                    MRR growing at {analyticsData.revenue.growth}% month-over-month
                  </li>
                  <li className="flex items-center">
                    <TrendingUpIcon className="h-4 w-4 text-blue-500 mr-2" />
                    Forecast suggests ${analyticsData.revenue.forecast.toLocaleString()} next month
                  </li>
                  <li className="flex items-center">
                    <BuildingOfficeIcon className="h-4 w-4 text-purple-500 mr-2" />
                    Enterprise plan accounts for {((analyticsData.revenue.byPlan.enterprise / analyticsData.revenue.currentMRR) * 100).toFixed(1)}% of revenue
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Platform Performance</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <ChartBarIcon className="h-4 w-4 text-green-500 mr-2" />
                    {analyticsData.platform.successRate}% test success rate
                  </li>
                  <li className="flex items-center">
                    <TrendingUpIcon className="h-4 w-4 text-green-500 mr-2" />
                    {analyticsData.platform.uptime}% uptime maintained
                  </li>
                  <li className="flex items-center">
                    <PlayIcon className="h-4 w-4 text-blue-500 mr-2" />
                    {analyticsData.platform.totalTestRuns.toLocaleString()} total test runs processed
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No Analytics Data</h3>
          <p className="mt-1 text-sm text-gray-500">
            Analytics data is not available at this time.
          </p>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;