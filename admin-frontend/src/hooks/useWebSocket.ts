import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from 'react-query';

interface WebSocketHookOptions {
  namespace?: string;
  autoConnect?: boolean;
  subscriptions?: string[];
}

interface WebSocketHook {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  subscribe: (room: string) => void;
  unsubscribe: (room: string) => void;
  emit: (event: string, data?: any) => void;
}

const WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_URL || 'http://localhost:3001';

export const useWebSocket = (options: WebSocketHookOptions = {}): WebSocketHook => {
  const {
    namespace = '/admin',
    autoConnect = true,
    subscriptions = []
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();
  const subscriptionsRef = useRef<Set<string>>(new Set());

  const getAuthToken = useCallback(() => {
    // Get JWT token from localStorage or your auth context
    return localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setError('No authentication token available');
      return;
    }

    setIsConnecting(true);
    setError(null);

    socketRef.current = io(`${WEBSOCKET_URL}${namespace}`, {
      auth: {
        token
      },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      retries: 3
    });

    const socket = socketRef.current;

    // Connection events
    socket.on('connect', () => {
      console.log('WebSocket connected:', socket.id);
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);

      // Re-subscribe to rooms after reconnection
      subscriptionsRef.current.forEach(room => {
        socket.emit(`subscribe-${room}`);
      });
    });

    socket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err);
      setIsConnected(false);
      setIsConnecting(false);
      setError(err.message || 'Connection failed');
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
      setIsConnecting(false);
    });

    // Real-time event handlers
    socket.on('system-health-update', (data) => {
      console.log('System health update received:', data);
      queryClient.setQueryData('system-health', data);
    });

    socket.on('activity-feed-update', (data) => {
      console.log('Activity feed update received:', data);
      queryClient.setQueryData('admin-activity', data);
    });

    socket.on('new-activity', (activity) => {
      console.log('New activity received:', activity);
      // Add new activity to existing activity feed
      queryClient.setQueryData('admin-activity', (oldData: any) => {
        if (!oldData) return { activity: [activity] };
        return {
          activity: [activity, ...oldData.activity.slice(0, 9)] // Keep only 10 most recent
        };
      });
    });

    socket.on('support-tickets-stats-update', (data) => {
      console.log('Support ticket stats update received:', data);
      queryClient.setQueryData('support-ticket-stats', data);
    });

    socket.on('support-ticket-update', ({ ticket, eventType }) => {
      console.log('Support ticket update received:', { ticket, eventType });
      
      // Invalidate support tickets queries to refetch updated data
      queryClient.invalidateQueries(['support-tickets']);
      queryClient.invalidateQueries('support-ticket-stats');
    });

    socket.on('analytics-overview-update', (data) => {
      console.log('Analytics overview update received:', data);
      queryClient.setQueryData('admin-overview', data);
    });

    socket.on('analytics-metrics-update', (data) => {
      console.log('Analytics metrics update received:', data);
      queryClient.setQueryData('admin-metrics', data);
    });

    socket.on('organization-update', ({ organization, eventType }) => {
      console.log('Organization update received:', { organization, eventType });
      
      // Invalidate organizations queries
      queryClient.invalidateQueries(['admin-organizations']);
      queryClient.invalidateQueries('admin-overview');
    });

    socket.on('user-update', ({ user, eventType }) => {
      console.log('User update received:', { user, eventType });
      
      // Invalidate users queries
      queryClient.invalidateQueries(['admin-users']);
      queryClient.invalidateQueries('admin-overview');
    });

    // Subscribe to initial subscriptions
    subscriptions.forEach(room => {
      subscribe(room);
    });

  }, [namespace, getAuthToken, queryClient, subscriptions]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setIsConnecting(false);
      subscriptionsRef.current.clear();
    }
  }, []);

  const subscribe = useCallback((room: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(`subscribe-${room}`);
      subscriptionsRef.current.add(room);
      console.log(`Subscribed to ${room}`);
    }
  }, []);

  const unsubscribe = useCallback((room: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(`unsubscribe-${room}`);
      subscriptionsRef.current.delete(room);
      console.log(`Unsubscribed from ${room}`);
    }
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Reconnect on token change
  useEffect(() => {
    const token = getAuthToken();
    if (token && !isConnected && !isConnecting && autoConnect) {
      connect();
    }
  }, [getAuthToken, isConnected, isConnecting, autoConnect, connect]);

  return {
    socket: socketRef.current,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    emit
  };
};

// Specialized hooks for specific pages
export const useSystemHealthWebSocket = () => {
  return useWebSocket({
    subscriptions: ['system-health'],
    autoConnect: false // Disable WebSocket connections
  });
};

export const useActivityFeedWebSocket = () => {
  return useWebSocket({
    subscriptions: ['activity-feed'],
    autoConnect: false // Disable WebSocket connections
  });
};

export const useSupportTicketsWebSocket = () => {
  return useWebSocket({
    subscriptions: ['support-tickets'],
    autoConnect: false // Disable WebSocket connections
  });
};

export const useAnalyticsWebSocket = () => {
  return useWebSocket({
    subscriptions: ['analytics'],
    autoConnect: false // Disable WebSocket connections
  });
};

export const useAdminDashboardWebSocket = () => {
  return useWebSocket({
    subscriptions: ['system-health', 'activity-feed', 'analytics'],
    autoConnect: false // Disable WebSocket connections for now
  });
};