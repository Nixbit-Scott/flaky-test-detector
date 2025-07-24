import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  XCircleIcon,
  InformationCircleIcon 
} from '@heroicons/react/24/outline';
import classNames from 'classnames';

interface ActivityItem {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: string | Date;
  details?: any;
}

interface ActivityFeedProps {
  data: ActivityItem[];
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ data }) => {
  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'success':
        return CheckCircleIcon;
      case 'warning':
        return ExclamationTriangleIcon;
      case 'error':
        return XCircleIcon;
      default:
        return InformationCircleIcon;
    }
  };

  const getIconClasses = (type: ActivityItem['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-500';
      case 'warning':
        return 'text-yellow-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-blue-500';
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8">
        <InformationCircleIcon className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-2 text-sm text-gray-500">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul role="list" className="-mb-8">
        {data.slice(0, 10).map((item, index) => {
          const Icon = getIcon(item.type);
          const isLast = index === data.length - 1 || index === 9;
          
          return (
            <li key={item.id}>
              <div className="relative pb-8">
                {!isLast && (
                  <span
                    className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex space-x-3">
                  <div>
                    <span
                      className={classNames(
                        'h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white',
                        item.type === 'success' && 'bg-green-100',
                        item.type === 'warning' && 'bg-yellow-100',
                        item.type === 'error' && 'bg-red-100',
                        item.type === 'info' && 'bg-blue-100'
                      )}
                    >
                      <Icon
                        className={classNames('h-4 w-4', getIconClasses(item.type))}
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div>
                      <p className="text-sm text-gray-900">{item.message}</p>
                    </div>
                    <div className="whitespace-nowrap text-right text-sm text-gray-500">
                      {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ActivityFeed;