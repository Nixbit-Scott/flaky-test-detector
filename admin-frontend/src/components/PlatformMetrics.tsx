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

  // Get the latest values from the time series data
  const latestCpu = data.cpuUsage?.[data.cpuUsage.length - 1]?.value || 0;
  const latestMemory = data.memoryUsage?.[data.memoryUsage.length - 1]?.value || 0;
  const latestRequestRate = data.requestRate?.[data.requestRate.length - 1]?.value || 0;

  const metrics = [
    {
      label: 'CPU Usage',
      value: latestCpu,
      color: latestCpu > 80 ? 'red' : latestCpu > 60 ? 'yellow' : 'green',
      format: (value: number) => `${value.toFixed(1)}%`,
    },
    {
      label: 'Memory Usage',
      value: latestMemory,
      color: latestMemory > 80 ? 'red' : latestMemory > 60 ? 'yellow' : 'green',
      format: (value: number) => `${value.toFixed(1)}%`,
    },
    {
      label: 'Request Rate',
      value: latestRequestRate,
      color: latestRequestRate > 200 ? 'green' : latestRequestRate > 100 ? 'yellow' : 'red',
      format: (value: number) => `${value.toFixed(0)} req/min`,
    },
    {
      label: 'System Health',
      value: 95, // Mock value
      color: 'green',
      format: (value: number) => `${value.toFixed(1)}%`,
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
            <p className="text-gray-500">Avg CPU</p>
            <p className="text-xl font-semibold text-gray-900">
              {latestCpu.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-gray-500">Avg Memory</p>
            <p className="text-xl font-semibold text-gray-900">
              {latestMemory.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatformMetrics;