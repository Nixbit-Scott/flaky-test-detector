import { User } from '@prisma/client';
import { Session, SessionData } from 'express-session';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        organizationId?: string;
        sso?: boolean;
      };
      ssoContext?: {
        organizationId: string;
        providerId: string;
        redirectUrl?: string;
      };
    }
    
    interface Session extends Session, SessionData {
      ssoRedirectUrl?: string;
    }
  }
}