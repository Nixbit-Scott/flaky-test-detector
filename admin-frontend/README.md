# Flaky Test Detector - Admin Dashboard

A comprehensive administration dashboard for managing the Flaky Test Detector SaaS platform. This admin interface provides system-wide visibility and control over users, organizations, billing, and platform health.

## Features

### ✅ Implemented
- **Authentication System**: Super admin role verification with JWT tokens
- **Dashboard Overview**: Real-time platform metrics and statistics
- **Modern UI**: Professional interface built with React, TypeScript, and Tailwind CSS
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Real-time Updates**: Auto-refreshing data with React Query
- **Security**: Role-based access control with audit logging

### 🚧 In Development
- **Organization Management**: Search, filter, suspend/reactivate organizations
- **User Management**: Platform-wide user controls and admin privilege management
- **System Health Monitoring**: Service health checks and performance metrics
- **Audit Logs**: Comprehensive activity tracking and compliance reporting
- **Advanced Analytics**: Business intelligence and revenue analytics

### 🔮 Planned
- **Real-time Notifications**: WebSocket-based live updates
- **Billing Management**: Subscription and payment management tools
- **Support Tickets**: Customer success and support ticket management
- **System Configuration**: Feature flags and platform configuration

## Architecture

### Frontend Stack
- **React 18** with TypeScript for type safety
- **React Router** for client-side routing
- **React Query** for server state management
- **Tailwind CSS** for styling
- **Headless UI** for accessible components
- **Heroicons** for consistent iconography
- **Vite** for fast development and building

### Backend Integration
- **Express.js API** with admin-specific endpoints
- **Prisma ORM** with PostgreSQL for data persistence
- **JWT Authentication** with role-based access control
- **Comprehensive Audit Logging** for compliance
- **Real-time Metrics** collection and reporting

## Getting Started

### Prerequisites
- Node.js 18+
- npm 8+
- Access to the backend API
- System administrator privileges

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Environment Configuration

The admin dashboard connects to the backend API at `/api`. In development, Vite proxies requests to `http://localhost:3001`.

### Access Requirements

To access the admin dashboard:
1. You must have a user account with `isSystemAdmin: true`
2. The backend must be running with admin API endpoints enabled
3. Valid JWT token with admin privileges

## Development

### Project Structure

```
admin-frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Layout.tsx       # Main layout with sidebar and header
│   │   ├── Sidebar.tsx      # Navigation sidebar
│   │   ├── Header.tsx       # Top header with user menu
│   │   ├── StatsCard.tsx    # Dashboard metrics cards
│   │   ├── ActivityFeed.tsx # Real-time activity feed
│   │   └── ...
│   ├── pages/              # Page components
│   │   ├── DashboardPage.tsx    # Main dashboard overview
│   │   ├── LoginPage.tsx        # Admin login
│   │   ├── OrganizationsPage.tsx # Organization management
│   │   ├── UsersPage.tsx        # User management
│   │   └── ...
│   ├── contexts/           # React contexts
│   │   └── AuthContext.tsx  # Authentication state management
│   ├── services/           # API services
│   │   ├── api.ts          # Base API client with interceptors
│   │   ├── authService.ts  # Authentication API calls
│   │   └── adminService.ts # Admin-specific API calls
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
├── public/                 # Static assets
└── dist/                   # Built application
```

### Key Components

#### Authentication System
- **AuthContext**: Manages admin authentication state
- **ProtectedRoute**: Ensures only system admins can access routes
- **JWT Handling**: Automatic token refresh and expiration handling

#### Dashboard Features
- **Real-time Metrics**: Auto-refreshing platform statistics
- **Activity Feed**: Live stream of platform events
- **Health Monitoring**: System service status indicators
- **Responsive Design**: Mobile-friendly responsive layout

### API Integration

The dashboard integrates with these admin API endpoints:

- `GET /api/admin/overview` - Platform overview statistics
- `GET /api/admin/metrics` - Platform performance metrics
- `GET /api/admin/organizations` - Organization management
- `GET /api/admin/users` - User management
- `GET /api/admin/health` - System health status
- `GET /api/admin/audit-logs` - Audit trail

### Security Features

1. **Role-based Access Control**: Only users with `isSystemAdmin: true` can access
2. **JWT Token Validation**: Automatic token verification and refresh
3. **Audit Logging**: All admin actions are logged for compliance
4. **Session Management**: Secure session handling with automatic logout
5. **CSRF Protection**: Built-in protection against cross-site request forgery

## Deployment

### Development
```bash
# Start admin dashboard in development mode
npm run dev:admin

# Start all services (backend + frontend + admin)
npm run dev:all
```

### Production Build
```bash
# Build the admin dashboard
npm run build:admin

# Build all applications
npm run build
```

### Environment Variables

No additional environment variables required - the dashboard uses the same backend API configuration as the main application.

## Monitoring and Observability

### Metrics Tracked
- Total organizations and active users
- Test execution statistics
- Monthly recurring revenue (MRR)
- System uptime and performance
- Customer health scores

### Real-time Features
- Live activity feed with platform events
- Auto-refreshing dashboard metrics
- System health status indicators
- Performance monitoring alerts

## Security Considerations

1. **Admin-Only Access**: Restricted to system administrators only
2. **Audit Trail**: Complete logging of all administrative actions
3. **Secure Authentication**: JWT-based authentication with role verification
4. **Data Protection**: Sensitive data handling with proper sanitization
5. **Rate Limiting**: Protection against abuse and DoS attacks

## Contributing

### Code Style
- Follow TypeScript best practices
- Use Tailwind CSS for styling
- Implement proper error handling
- Write accessible components
- Follow React Query patterns for data fetching

### Testing
- Unit tests for components
- Integration tests for API interactions
- E2E tests for critical user flows
- Accessibility testing

## Support

For admin dashboard issues or questions:
1. Check the system health dashboard
2. Review audit logs for admin actions
3. Contact the development team
4. Submit issues to the project repository

## Future Enhancements

- **Advanced Analytics**: Revenue forecasting and customer insights
- **Automated Alerts**: Proactive monitoring and alerting
- **Bulk Operations**: Mass organization and user management
- **Custom Reporting**: Configurable reports and exports
- **API Rate Limiting**: Granular control over API usage
- **Multi-tenant Management**: Enhanced organization isolation