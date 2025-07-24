import React from 'react';
import { PlatformMetrics as PlatformMetricsType } from '../types';

interface PlatformMetricsProps {
  data?: PlatformMetricsType;
}

const PlatformMetrics: React.FC<PlatformMetricsProps> = ({ data }) => {
  if (!data) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-500">No metrics data available</p>
      </div>
    );
  }

  const metrics = [
    {
      label: 'Test Success Rate',
      value: data.successRate,
      color: data.successRate > 90 ? 'green' : data.successRate > 80 ? 'yellow' : 'red',
      format: (value: number) => `${value.toFixed(1)}%`,
    },
    {
      label: 'System Uptime',
      value: data.uptime,
      color: data.uptime > 99.5 ? 'green' : data.uptime > 99 ? 'yellow' : 'red',
      format: (value: number) => `${value.toFixed(1)}%`,
    },
    {
      label: 'Customer Health',
      value: data.customerHealth,
      color: data.customerHealth > 85 ? 'green' : data.customerHealth > 70 ? 'yellow' : 'red',
      format: (value: number) => `${value.toFixed(1)}%`,
    },
    {
      label: 'Revenue Growth',
      value: data.revenueGrowth,
      color: data.revenueGrowth > 0 ? 'green' : data.revenueGrowth > -5 ? 'yellow' : 'red',
      format: (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`,
    },
  ];

  const getBarColor = (color: string) => {
    switch (color) {
      case 'green':
        return 'bg-green-500';
      case 'yellow':
        return 'bg-yellow-500';
      case 'red':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {metrics.map((metric, index) => (
        <div key={index}>
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-900">{metric.label}</span>
            <span className="text-gray-600">{metric.format(metric.value)}</span>
          </div>
          <div className="mt-2">
            <div className="bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${getBarColor(metric.color)}`}
                style={{ 
                  width: `${Math.min(100, Math.max(0, metric.value))}%` 
                }}
              />
            </div>
          </div>
        </div>
      ))}

      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Total Revenue</p>
            <p className="text-xl font-semibold text-gray-900">
              ${data.totalRevenue.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Churn Rate</p>
            <p className="text-xl font-semibold text-gray-900">
              {data.churnRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatformMetrics;