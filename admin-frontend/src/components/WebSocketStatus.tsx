import React from 'react';
import {
  WifiIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface WebSocketStatusProps {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  onReconnect?: () => void;
  className?: string;
}

const WebSocketStatus: React.FC<WebSocketStatusProps> = ({
  isConnected,
  isConnecting,
  error,
  onReconnect,
  className = ''
}) => {
  const getStatusColor = () => {
    if (isConnecting) return 'text-yellow-600 bg-yellow-100';
    if (isConnected) return 'text-green-600 bg-green-100';
    return 'text-red-600 bg-red-100';
  };

  const getStatusText = () => {
    if (isConnecting) return 'Connecting...';
    if (isConnected) return 'Connected';
    return error ? 'Connection Error' : 'Disconnected';
  };

  const getStatusIcon = () => {
    if (isConnecting) {
      return <ArrowPathIcon className="h-4 w-4 animate-spin" />;
    }
    if (isConnected) {
      return <WifiIcon className="h-4 w-4" />;
    }
    return <ExclamationTriangleIcon className="h-4 w-4" />;
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
        {getStatusIcon()}
        <span className="ml-1.5">{getStatusText()}</span>
      </div>
      
      {error && !isConnected && onReconnect && (
        <button
          onClick={onReconnect}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          title="Reconnect to real-time updates"
        >
          Retry
        </button>
      )}
      
      {error && (
        <div className="text-xs text-red-600" title={error}>
          {error.length > 20 ? `${error.substring(0, 20)}...` : error}
        </div>
      )}
    </div>
  );
};

export default WebSocketStatus;