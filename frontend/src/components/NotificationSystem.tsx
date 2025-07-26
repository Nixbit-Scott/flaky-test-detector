import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, X, AlertTriangle, CheckCircle, Info, 
  Clock, TrendingUp, Users, GitBranch, Zap 
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'alert' | 'success' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: Date;
  project?: string;
  actionRequired?: boolean;
  read: boolean;
}

interface NotificationSystemProps {
  organizationId?: string;
}

const NotificationSystem: React.FC<NotificationSystemProps> = ({ organizationId }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Simulate real-time notifications
  useEffect(() => {
    const mockNotifications: Notification[] = [
      {
        id: '1',
        type: 'alert',
        title: 'Flaky Test Detected',
        message: 'test_user_authentication is failing intermittently in the Web App project (3/5 recent runs)',
        timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        project: 'Web App',
        actionRequired: true,
        read: false
      },
      {
        id: '2',
        type: 'warning',
        title: 'Test Reliability Declining',
        message: 'API Service test reliability dropped from 97.2% to 94.9% over the last 24 hours',
        timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        project: 'API Service',
        actionRequired: false,
        read: false
      },
      {
        id: '3',
        type: 'success',
        title: 'Issue Resolved',
        message: 'The database connection timeout issue in Mobile App has been automatically resolved with retry logic',
        timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        project: 'Mobile App',
        actionRequired: false,
        read: false
      },
      {
        id: '4',
        type: 'info',
        title: 'Weekly Report Generated',
        message: 'Your weekly executive summary report is now available for download',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        project: undefined,
        actionRequired: false,
        read: true
      },
      {
        id: '5',
        type: 'alert',
        title: 'Critical Pipeline Failure',
        message: 'Data Pipeline project has failed 5 consecutive test runs - immediate attention required',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        project: 'Data Pipeline',
        actionRequired: true,
        read: true
      }
    ];

    setNotifications(mockNotifications);
    setUnreadCount(mockNotifications.filter(n => !n.read).length);

    // Simulate new notifications coming in
    const interval = setInterval(() => {
      const newNotification: Notification = {
        id: Date.now().toString(),
        type: Math.random() > 0.7 ? 'alert' : Math.random() > 0.5 ? 'warning' : 'info',
        title: 'New Test Result',
        message: `Latest test run completed with ${Math.floor(Math.random() * 10)} flaky tests detected`,
        timestamp: new Date(),
        project: ['Web App', 'API Service', 'Mobile App'][Math.floor(Math.random() * 3)],
        actionRequired: Math.random() > 0.7,
        read: false
      };

      setNotifications(prev => [newNotification, ...prev.slice(0, 9)]); // Keep only 10 most recent
      setUnreadCount(prev => prev + 1);
    }, 30000); // New notification every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'alert': return AlertTriangle;
      case 'success': return CheckCircle;
      case 'warning': return Clock;
      case 'info': return Info;
      default: return Bell;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'alert': return 'text-red-600 bg-red-50 border-red-200';
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const handleMarkAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleDismiss = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    const notification = notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Notification Panel */}
      <AnimatePresence>
        {showNotifications && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setShowNotifications(false)}
            />
            
            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-96 overflow-hidden"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                <div className="flex items-center space-x-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Notifications List */}
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500">
                    <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {notifications.map((notification) => {
                      const Icon = getNotificationIcon(notification.type);
                      const colorClass = getNotificationColor(notification.type);
                      
                      return (
                        <motion.div
                          key={notification.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`px-4 py-3 hover:bg-gray-50 transition-colors ${
                            !notification.read ? 'bg-blue-50/30' : ''
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className={`p-2 rounded-lg ${colorClass}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className={`text-sm font-medium text-gray-900 ${
                                    !notification.read ? 'font-semibold' : ''
                                  }`}>
                                    {notification.title}
                                  </p>
                                  {notification.project && (
                                    <p className="text-xs text-gray-500 mb-1">
                                      <GitBranch className="w-3 h-3 inline mr-1" />
                                      {notification.project}
                                    </p>
                                  )}
                                  <p className="text-sm text-gray-600 mb-2">
                                    {notification.message}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {formatTimeAgo(notification.timestamp)}
                                  </p>
                                </div>
                                
                                <div className="flex items-center space-x-1 ml-2">
                                  {!notification.read && (
                                    <button
                                      onClick={() => handleMarkAsRead(notification.id)}
                                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                    >
                                      Mark read
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDismiss(notification.id)}
                                    className="text-gray-400 hover:text-gray-600"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              
                              {notification.actionRequired && (
                                <div className="mt-2">
                                  <button className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-medium">
                                    Action Required
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-200 text-center">
                  <button className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                    View all notifications
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationSystem;