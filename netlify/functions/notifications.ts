import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import * as jwt from 'jsonwebtoken';

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// Simple in-memory store for notifications (resets on cold start)
// In production, this would be stored in a database
const notifications: Map<string, {
  id: string;
  userId: string;
  type: 'alert' | 'success' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: string;
  project?: string;
  actionRequired: boolean;
  read: boolean;
  createdAt: string;
}> = new Map();

// Helper function to verify JWT and get user
async function getUserFromToken(authHeader: string | undefined) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No valid token provided');
  }

  const token = authHeader.substring(7);
  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
  
  try {
    const decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string };
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    console.log('Notifications function called:', {
      path: event.path,
      httpMethod: event.httpMethod,
    });

    // Validate authorization
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = await getUserFromToken(authHeader);

    // Handle different HTTP methods
    switch (event.httpMethod) {
      case 'GET':
        return await handleGetNotifications(event, user);
      case 'POST':
        return await handleCreateNotification(event, user);
      case 'PUT':
        return await handleMarkAsRead(event, user);
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Notifications function error:', error);
    return {
      statusCode: error instanceof Error && error.message.includes('token') ? 401 : 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
    };
  }
};

async function handleGetNotifications(event: HandlerEvent, user: { userId: string; email: string }) {
  try {
    // Get notifications for the authenticated user
    const userNotifications = Array.from(notifications.values())
      .filter(notification => notification.userId === user.userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20); // Limit to 20 most recent

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        notifications: userNotifications,
        total: userNotifications.length,
        unreadCount: userNotifications.filter(n => !n.read).length,
      }),
    };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch notifications' }),
    };
  }
}

async function handleCreateNotification(event: HandlerEvent, user: { userId: string; email: string }) {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const body = JSON.parse(event.body);
    const { type, title, message, project, actionRequired = false } = body;
    
    // Create notification
    const notificationId = 'notification-' + Date.now();
    const now = new Date().toISOString();
    
    const notification = {
      id: notificationId,
      userId: user.userId,
      type: type || 'info',
      title: title || 'Notification',
      message: message || '',
      timestamp: now,
      project: project || undefined,
      actionRequired: Boolean(actionRequired),
      read: false,
      createdAt: now,
    };

    // Store notification
    notifications.set(notificationId, notification);

    console.log('Notification created successfully:', {
      id: notificationId,
      userId: user.userId,
      type: notification.type,
    });

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Notification created successfully',
        notification,
      }),
    };
  } catch (error) {
    console.error('Error creating notification:', error);
    
    if (error instanceof SyntaxError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to create notification' }),
    };
  }
}

async function handleMarkAsRead(event: HandlerEvent, user: { userId: string; email: string }) {
  try {
    const notificationId = event.queryStringParameters?.notificationId;
    const markAll = event.queryStringParameters?.markAll === 'true';
    
    if (markAll) {
      // Mark all notifications as read for this user
      for (const notification of notifications.values()) {
        if (notification.userId === user.userId) {
          notification.read = true;
        }
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'All notifications marked as read' }),
      };
    }
    
    if (!notificationId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Notification ID is required' }),
      };
    }

    const notification = notifications.get(notificationId);
    if (!notification || notification.userId !== user.userId) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Notification not found' }),
      };
    }

    // Mark as read
    notification.read = true;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Notification marked as read',
        notification,
      }),
    };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to mark notification as read' }),
    };
  }
}