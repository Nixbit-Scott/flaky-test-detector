import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, X, Send, Star, ThumbsUp, ThumbsDown,
  Bug, Lightbulb, AlertCircle, Check, ChevronRight
} from 'lucide-react';
import { useFeatureFlag } from '../hooks/useFeatureFlags';
import { useAuth } from '../contexts/AuthContext';

interface FeedbackData {
  type: 'bug' | 'feature' | 'improvement' | 'general';
  rating?: number;
  sentiment?: 'positive' | 'negative' | 'neutral';
  message: string;
  page: string;
  userAgent: string;
  timestamp: string;
  userId?: string;
  organizationId?: string;
}

interface FeedbackTrigger {
  id: string;
  type: 'contextual' | 'timed' | 'action-based';
  condition: string;
  message: string;
  delay?: number;
}

const FEEDBACK_TRIGGERS: FeedbackTrigger[] = [
  {
    id: 'project-creation-success',
    type: 'action-based',
    condition: 'project-created',
    message: 'How was your project setup experience?',
    delay: 2000,
  },
  {
    id: 'dashboard-time-spent',
    type: 'timed',
    condition: 'dashboard-5min',
    message: 'Finding everything you need on the dashboard?',
    delay: 300000, // 5 minutes
  },
  {
    id: 'flaky-test-detected',
    type: 'contextual',
    condition: 'flaky-test-found',
    message: 'How helpful was our flaky test detection?',
    delay: 1000,
  },
  {
    id: 'beta-weekly-checkin',
    type: 'timed',
    condition: 'weekly-usage',
    message: 'Quick feedback on your beta experience this week?',
    delay: 5000,
  },
];

export const FeedbackCollection: React.FC = () => {
  const feedbackEnabled = useFeatureFlag('feedback_collection');
  const { user, organization } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [currentTrigger, setCurrentTrigger] = useState<FeedbackTrigger | null>(null);
  const [feedbackType, setFeedbackType] = useState<FeedbackData['type']>('general');
  const [rating, setRating] = useState<number>(0);
  const [sentiment, setSentiment] = useState<FeedbackData['sentiment']>('neutral');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track page visits and actions for contextual triggers
  useEffect(() => {
    if (!feedbackEnabled) return;

    const handlePageAction = (action: string) => {
      const trigger = FEEDBACK_TRIGGERS.find(t => t.condition === action);
      if (trigger) {
        setTimeout(() => {
          setCurrentTrigger(trigger);
          setIsOpen(true);
        }, trigger.delay || 0);
      }
    };

    // Listen for custom events
    const handleCustomEvent = (event: CustomEvent) => {
      handlePageAction(event.detail.action);
    };

    window.addEventListener('feedback-trigger', handleCustomEvent as EventListener);

    // Set up timed triggers
    const timers: NodeJS.Timeout[] = [];
    
    // Dashboard time-spent trigger
    if (window.location.pathname.includes('/app')) {
      const dashboardTimer = setTimeout(() => {
        handlePageAction('dashboard-5min');
      }, 300000); // 5 minutes
      timers.push(dashboardTimer);
    }

    // Weekly check-in (simulate with shorter interval for demo)
    const weeklyTimer = setTimeout(() => {
      handlePageAction('weekly-usage');
    }, 60000); // 1 minute for demo
    timers.push(weeklyTimer);

    return () => {
      window.removeEventListener('feedback-trigger', handleCustomEvent as EventListener);
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [feedbackEnabled]);

  const handleSubmitFeedback = async () => {
    if (!message.trim()) {
      setError('Please provide feedback message');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const feedbackData: FeedbackData = {
        type: feedbackType,
        rating: rating > 0 ? rating : undefined,
        sentiment,
        message: message.trim(),
        page: window.location.pathname,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        userId: user?.id,
        organizationId: organization?.id,
      };

      const response = await fetch('/.netlify/functions/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          feedback: feedbackData,
          trigger: currentTrigger,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      setIsSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        setIsSubmitted(false);
        setMessage('');
        setRating(0);
        setSentiment('neutral');
        setFeedbackType('general');
        setCurrentTrigger(null);
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setCurrentTrigger(null);
    setMessage('');
    setRating(0);
    setSentiment('neutral');
    setFeedbackType('general');
    setError(null);
    setIsSubmitted(false);
  };

  if (!feedbackEnabled) {
    return null;
  }

  return (
    <>
      {/* Floating Feedback Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-primary-600 hover:bg-primary-700 text-white p-3 rounded-full shadow-lg z-40"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1 }}
      >
        <MessageSquare className="h-6 w-6" />
      </motion.button>

      {/* Feedback Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-lg shadow-xl w-full max-w-md"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              {isSubmitted ? (
                <div className="p-6 text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                    <Check className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Thank you for your feedback!
                  </h3>
                  <p className="text-sm text-gray-500">
                    Your feedback helps us improve the beta experience.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-6 border-b">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {currentTrigger ? currentTrigger.message : 'Share Your Feedback'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Help us improve your beta experience
                      </p>
                    </div>
                    <button
                      onClick={handleClose}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Feedback Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        What type of feedback is this?
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'bug', label: 'Bug Report', icon: Bug, color: 'red' },
                          { value: 'feature', label: 'Feature Request', icon: Lightbulb, color: 'blue' },
                          { value: 'improvement', label: 'Improvement', icon: ChevronRight, color: 'green' },
                          { value: 'general', label: 'General', icon: MessageSquare, color: 'gray' },
                        ].map(({ value, label, icon: Icon, color }) => (
                          <button
                            key={value}
                            onClick={() => setFeedbackType(value as FeedbackData['type'])}
                            className={`p-3 rounded-lg border-2 text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${
                              feedbackType === value
                                ? `border-${color}-500 bg-${color}-50 text-${color}-700`
                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sentiment */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        How do you feel about this?
                      </label>
                      <div className="flex justify-center space-x-4">
                        {[
                          { value: 'positive', icon: ThumbsUp, color: 'green' },
                          { value: 'neutral', icon: AlertCircle, color: 'yellow' },
                          { value: 'negative', icon: ThumbsDown, color: 'red' },
                        ].map(({ value, icon: Icon, color }) => (
                          <button
                            key={value}
                            onClick={() => setSentiment(value as FeedbackData['sentiment'])}
                            className={`p-3 rounded-full transition-colors ${
                              sentiment === value
                                ? `bg-${color}-100 text-${color}-600`
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                          >
                            <Icon className="h-6 w-6" />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Rating */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Rate your experience (optional)
                      </label>
                      <div className="flex justify-center space-x-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setRating(star)}
                            className={`transition-colors ${
                              star <= rating ? 'text-yellow-400' : 'text-gray-300'
                            }`}
                          >
                            <Star className="h-6 w-6 fill-current" />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Message */}
                    <div>
                      <label htmlFor="feedback-message" className="block text-sm font-medium text-gray-700 mb-2">
                        Your feedback
                      </label>
                      <textarea
                        id="feedback-message"
                        rows={4}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Tell us about your experience, what you like, what could be improved..."
                      />
                    </div>

                    {error && (
                      <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                        {error}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
                    <button
                      onClick={handleClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitFeedback}
                      disabled={isSubmitting || !message.trim()}
                      className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {isSubmitting ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      <span>{isSubmitting ? 'Submitting...' : 'Submit Feedback'}</span>
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Helper function to trigger feedback collection
export const triggerFeedback = (action: string) => {
  window.dispatchEvent(new CustomEvent('feedback-trigger', { detail: { action } }));
};

export default FeedbackCollection;