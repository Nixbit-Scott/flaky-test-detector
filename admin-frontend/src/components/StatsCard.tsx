import React from 'react';
import classNames from 'classnames';
import { HeroIcon } from '../types/heroicons';

interface StatsCardProps {
  title: string;
  value: string;
  icon: HeroIcon;
  color: 'blue' | 'green' | 'purple' | 'yellow' | 'red';
  change?: string;
  changeType?: 'increase' | 'decrease' | 'neutral';
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon: Icon,
  color,
  change,
  changeType = 'neutral',
}) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  const changeClasses = {
    increase: 'text-green-600',
    decrease: 'text-red-600',
    neutral: 'text-gray-600',
  };

  return (
    <div className="card p-6">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div
            className={classNames(
              'p-3 rounded-md',
              colorClasses[color]
            )}
          >
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">
              {title}
            </dt>
            <dd className="flex items-baseline">
              <div className="text-2xl font-semibold text-gray-900">
                {value}
              </div>
              {change && (
                <div
                  className={classNames(
                    'ml-2 flex items-baseline text-sm font-semibold',
                    changeClasses[changeType]
                  )}
                >
                  {change}
                </div>
              )}
            </dd>
          </dl>
        </div>
      </div>
    </div>
  );
};

export default StatsCard;