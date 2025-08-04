interface AnalyticsEvent {
  event: string;
  properties: Record<string, any>;
  userId?: string;
  organizationId?: string;
  sessionId: string;
  timestamp: string;
  page: string;
  userAgent: string;
  environment: string;
}

interface UserSession {
  sessionId: string;
  userId?: string;
  organizationId?: string;
  startTime: string;
  lastActivity: string;
  events: AnalyticsEvent[];
  metadata: {
    userAgent: string;
    referrer: string;
    screenResolution: string;
    timezone: string;
  };
}

interface PageView {
  page: string;
  title: string;
  timestamp: string;
  duration?: number;
  exitPage?: boolean;
}

class BetaAnalyticsService {
  private sessionId: string;
  private session: UserSession;
  private currentPage: string = '';
  private pageStartTime: number = 0;
  private eventQueue: AnalyticsEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private enabled: boolean = false;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.session = this.initializeSession();
    this.enabled = import.meta.env.VITE_ANALYTICS_ENHANCED === 'true' || 
                   import.meta.env.VITE_ENVIRONMENT === 'beta';
    
    if (this.enabled) {
      this.setupEventListeners();
      this.startPeriodicFlush();
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeSession(): UserSession {
    return {
      sessionId: this.sessionId,
      startTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      events: [],
      metadata: {
        userAgent: navigator.userAgent,
        referrer: document.referrer,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };
  }

  private setupEventListeners() {
    // Page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.track('page_focus');
      } else {
        this.track('page_blur');
      }
    });

    // Mouse and keyboard activity
    let lastActivity = Date.now();
    const updateActivity = () => {
      const now = Date.now();
      if (now - lastActivity > 30000) { // 30 seconds
        this.track('user_activity', { type: 'interaction' });
      }
      lastActivity = now;
      this.session.lastActivity = new Date().toISOString();
    };

    document.addEventListener('mousedown', updateActivity);
    document.addEventListener('keydown', updateActivity);
    document.addEventListener('scroll', updateActivity);

    // Page unload
    window.addEventListener('beforeunload', () => {
      this.track('session_end');
      this.flush();
    });

    // Error tracking
    window.addEventListener('error', (event) => {
      this.track('javascript_error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      });
    });

    // Performance tracking
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        this.track('page_performance', {
          loadTime: navigation.loadEventEnd - navigation.fetchStart,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
          firstPaint: this.getFirstPaint(),
          firstContentfulPaint: this.getFirstContentfulPaint(),
        });
      }, 100);
    });
  }

  private getFirstPaint(): number | null {
    const paintEntries = performance.getEntriesByType('paint');
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
    return firstPaint ? firstPaint.startTime : null;
  }

  private getFirstContentfulPaint(): number | null {
    const paintEntries = performance.getEntriesByType('paint');
    const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return firstContentfulPaint ? firstContentfulPaint.startTime : null;
  }

  private startPeriodicFlush() {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 30000); // Flush every 30 seconds
  }

  setUser(userId: string, organizationId?: string) {
    this.session.userId = userId;
    this.session.organizationId = organizationId;
    this.track('user_identified', { userId, organizationId });
  }

  track(event: string, properties: Record<string, any> = {}) {
    if (!this.enabled) return;

    const analyticsEvent: AnalyticsEvent = {
      event,
      properties: {
        ...properties,
        sessionId: this.sessionId,
      },
      userId: this.session.userId,
      organizationId: this.session.organizationId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      page: window.location.pathname,
      userAgent: navigator.userAgent,
      environment: import.meta.env.VITE_ENVIRONMENT || 'production',
    };

    this.eventQueue.push(analyticsEvent);
    this.session.events.push(analyticsEvent);

    // Flush immediately for critical events
    const criticalEvents = ['javascript_error', 'api_error', 'feature_error'];
    if (criticalEvents.includes(event)) {
      this.flush();
    }
  }

  pageView(page: string, title?: string) {
    if (!this.enabled) return;

    // Track exit from previous page
    if (this.currentPage && this.pageStartTime) {
      const duration = Date.now() - this.pageStartTime;
      this.track('page_exit', {
        page: this.currentPage,
        duration,
        exitPage: true,
      });
    }

    // Track new page view
    this.currentPage = page;
    this.pageStartTime = Date.now();
    
    this.track('page_view', {
      page,
      title: title || document.title,
      referrer: document.referrer,
    });
  }

  // Feature usage tracking
  featureUsed(feature: string, properties: Record<string, any> = {}) {
    this.track('feature_used', {
      feature,
      ...properties,
    });
  }

  // Button/UI element clicks
  elementClicked(element: string, properties: Record<string, any> = {}) {
    this.track('element_clicked', {
      element,
      ...properties,
    });
  }

  // Form interactions
  formStarted(formName: string) {
    this.track('form_started', { formName });
  }

  formSubmitted(formName: string, success: boolean, properties: Record<string, any> = {}) {
    this.track('form_submitted', {
      formName,
      success,
      ...properties,
    });
  }

  // API interactions
  apiCall(endpoint: string, method: string, statusCode: number, duration: number) {
    this.track('api_call', {
      endpoint,
      method,
      statusCode,
      duration,
      success: statusCode >= 200 && statusCode < 300,
    });
  }

  // Error tracking
  error(error: Error, context: Record<string, any> = {}) {
    this.track('application_error', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...context,
    });
  }

  // Custom events for beta testing
  betaFeatureTested(feature: string, result: 'success' | 'failure' | 'partial', feedback?: string) {
    this.track('beta_feature_tested', {
      feature,
      result,
      feedback,
    });
  }

  feedbackGiven(type: string, rating?: number, message?: string) {
    this.track('feedback_given', {
      type,
      rating,
      message,
    });
  }

  onboardingStep(step: string, completed: boolean, timeSpent?: number) {
    this.track('onboarding_step', {
      step,
      completed,
      timeSpent,
    });
  }

  private async flush() {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const response = await fetch('/.netlify/functions/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          events,
          session: this.session,
        }),
      });

      if (!response.ok) {
        // Re-queue events if failed
        this.eventQueue.unshift(...events);
        console.warn('Failed to flush analytics events');
      }
    } catch (error) {
      // Re-queue events if failed
      this.eventQueue.unshift(...events);
      console.warn('Analytics flush error:', error);
    }
  }

  // Get current session data
  getSession(): UserSession {
    return { ...this.session };
  }

  // Stop analytics tracking
  stop() {
    this.enabled = false;
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}

// Global analytics instance
const analytics = new BetaAnalyticsService();

// React hook for analytics
export const useAnalytics = () => {
  return {
    track: analytics.track.bind(analytics),
    pageView: analytics.pageView.bind(analytics),
    featureUsed: analytics.featureUsed.bind(analytics),
    elementClicked: analytics.elementClicked.bind(analytics),
    formStarted: analytics.formStarted.bind(analytics),
    formSubmitted: analytics.formSubmitted.bind(analytics),
    apiCall: analytics.apiCall.bind(analytics),
    error: analytics.error.bind(analytics),
    betaFeatureTested: analytics.betaFeatureTested.bind(analytics),
    feedbackGiven: analytics.feedbackGiven.bind(analytics),
    onboardingStep: analytics.onboardingStep.bind(analytics),
    setUser: analytics.setUser.bind(analytics),
  };
};

export default analytics;