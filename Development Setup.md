Development Setup

  # Install dependencies
  npm run setup

  # Start backend + admin dashboard
  npm run dev:backend
  npm run dev:admin

  # Or start everything at once
  npm run dev:all

  Access Requirements

  1. Create a user account in the system
  2. Update the user's isSystemAdmin field to true in the database
  3. Navigate to http://localhost:3000 (admin dashboard)
  4. Login with admin credentials

  Admin Dashboard Features

  - Dashboard Overview: Platform KPIs, real-time metrics, and activity monitoring
  - Professional Interface: Modern SaaS admin design with navigation and user management
  - Security: Role-based access with comprehensive audit logging
  - Responsive: Works on desktop and mobile devices

  The admin dashboard provides a solid foundation for managing the Flaky Test Detector SaaS platform, with a professional interface that can scale as the business grows. The modular
   architecture makes it easy to add new features and integrations as needed.


🛠️ Alternative: Start Services Individually

  If there are still conflicts, you can start them individually:

  # Terminal 1: Backend
  cd backend && npm run dev

  # Terminal 2: Customer Frontend  
  cd frontend && npm run dev

  # Terminal 3: Admin Dashboard
  cd admin-frontend && npm run dev



  1. Test the Login: Navigate to http://localhost:3000
  2. Create Admin User (if needed):
  UPDATE users SET "isSystemAdmin" = true WHERE email = 'your-email@example.com';
  3. Login with your admin credentials
  4. Explore the admin dashboard features

  The CSS compilation error should be resolved now! 🚀