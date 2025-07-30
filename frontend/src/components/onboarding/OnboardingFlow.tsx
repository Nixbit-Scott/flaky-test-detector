/**
 * Interactive Onboarding Flow for New Nixbit Users
 * Guides users through setup, integration, and first success
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircleIcon, ArrowRightIcon, PlayIcon, BookOpenIcon, VideoCameraIcon } from '@heroicons/react/24/outline';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<OnboardingStepProps>;
  isCompleted: boolean;
  isOptional?: boolean;
  estimatedTime?: string;
}

interface OnboardingStepProps {
  onComplete: () => void;
  onSkip?: () => void;
  step: OnboardingStep;
}

interface OnboardingProgress {
  currentStep: number;
  completedSteps: string[];
  skippedSteps: string[];
  startedAt: Date;
  lastActiveAt: Date;
}

const OnboardingFlow: React.FC = () => {
  const { user } = useAuth();
  const [progress, setProgress] = useState<OnboardingProgress>({
    currentStep: 0,
    completedSteps: [],
    skippedSteps: [],
    startedAt: new Date(),
    lastActiveAt: new Date()
  });

  const [isVisible, setIsVisible] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  // Define onboarding steps
  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Nixbit',
      description: 'Learn what Nixbit can do for your team',
      component: WelcomeStep,
      isCompleted: false,
      estimatedTime: '2 min'
    },
    {
      id: 'organization-setup',
      title: 'Set Up Your Organization',
      description: 'Create your team and invite members',
      component: OrganizationSetupStep,
      isCompleted: false,
      estimatedTime: '3 min'
    },
    {
      id: 'project-connection',
      title: 'Connect Your First Project',
      description: 'Integrate with GitHub, GitLab, or Jenkins',
      component: ProjectConnectionStep,
      isCompleted: false,
      estimatedTime: '5 min'
    },
    {
      id: 'configure-policies',
      title: 'Configure Quarantine Policies',
      description: 'Set up automatic flaky test management',
      component: ConfigurePoliciesStep,
      isCompleted: false,
      isOptional: true,
      estimatedTime: '3 min'
    },
    {
      id: 'first-test-run',
      title: 'Run Your First Test',
      description: 'Trigger a test run and see the magic happen',
      component: FirstTestRunStep,
      isCompleted: false,
      estimatedTime: '5 min'
    },
    {
      id: 'explore-features',
      title: 'Explore Key Features',
      description: 'Quick tour of analytics, AI insights, and quarantine management',
      component: ExploreFeaturesStep,
      isCompleted: false,
      estimatedTime: '4 min'
    },
    {
      id: 'success-celebration',
      title: 'You\'re All Set!',
      description: 'Celebrate your success and plan next steps',
      component: SuccessCelebrationStep,
      isCompleted: false,
      estimatedTime: '2 min'
    }
  ];

  // Load progress from localStorage
  useEffect(() => {
    const savedProgress = localStorage.getItem(`nixbit-onboarding-${user?.id}`);
    if (savedProgress) {
      const parsed = JSON.parse(savedProgress);
      setProgress({
        ...parsed,
        startedAt: new Date(parsed.startedAt),
        lastActiveAt: new Date(parsed.lastActiveAt)
      });
    }

    // Check if user has completed onboarding
    const completed = localStorage.getItem(`nixbit-onboarding-completed-${user?.id}`);
    setHasCompletedOnboarding(!!completed);

    // Show onboarding for new users
    if (!completed && user?.createdAt) {
      const userAge = Date.now() - new Date(user.createdAt).getTime();
      const daysSinceSignup = userAge / (1000 * 60 * 60 * 24);
      
      // Show onboarding for users who signed up within the last 7 days
      if (daysSinceSignup <= 7) {
        setIsVisible(true);
      }
    }
  }, [user]);

  // Save progress to localStorage
  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`nixbit-onboarding-${user.id}`, JSON.stringify(progress));
    }
  }, [progress, user?.id]);

  const handleStepComplete = (stepId: string) => {
    setProgress(prev => ({
      ...prev,
      completedSteps: [...prev.completedSteps, stepId],
      currentStep: Math.min(prev.currentStep + 1, steps.length - 1),
      lastActiveAt: new Date()
    }));

    // Mark step as completed
    steps[steps.findIndex(s => s.id === stepId)].isCompleted = true;

    // Track completion event
    if (window.gtag) {
      window.gtag('event', 'onboarding_step_completed', {
        step_id: stepId,
        step_number: steps.findIndex(s => s.id === stepId) + 1,
        total_steps: steps.length
      });
    }

    // Check if onboarding is complete
    if (progress.completedSteps.length + 1 >= steps.filter(s => !s.isOptional).length) {
      handleOnboardingComplete();
    }
  };

  const handleStepSkip = (stepId: string) => {
    setProgress(prev => ({
      ...prev,
      skippedSteps: [...prev.skippedSteps, stepId],
      currentStep: Math.min(prev.currentStep + 1, steps.length - 1),
      lastActiveAt: new Date()
    }));

    // Track skip event
    if (window.gtag) {
      window.gtag('event', 'onboarding_step_skipped', {
        step_id: stepId,
        step_number: steps.findIndex(s => s.id === stepId) + 1
      });
    }
  };

  const handleOnboardingComplete = () => {
    setHasCompletedOnboarding(true);
    localStorage.setItem(`nixbit-onboarding-completed-${user?.id}`, 'true');
    
    // Track completion
    if (window.gtag) {
      window.gtag('event', 'onboarding_completed', {
        completion_time: Date.now() - progress.startedAt.getTime(),
        steps_completed: progress.completedSteps.length,
        steps_skipped: progress.skippedSteps.length
      });
    }

    // Show success celebration
    setProgress(prev => ({ ...prev, currentStep: steps.length - 1 }));
  };

  const handleRestart = () => {
    setProgress({
      currentStep: 0,
      completedSteps: [],
      skippedSteps: [],
      startedAt: new Date(),
      lastActiveAt: new Date()
    });
    setHasCompletedOnboarding(false);
    localStorage.removeItem(`nixbit-onboarding-${user?.id}`);
    localStorage.removeItem(`nixbit-onboarding-completed-${user?.id}`);
    setIsVisible(true);
  };

  const handleClose = () => {
    setIsVisible(false);
    
    // Track dismissal
    if (window.gtag) {
      window.gtag('event', 'onboarding_dismissed', {
        step_number: progress.currentStep + 1,
        completion_percentage: (progress.completedSteps.length / steps.length) * 100
      });
    }
  };

  const currentStep = steps[progress.currentStep];
  const progressPercentage = ((progress.completedSteps.length + progress.skippedSteps.length) / steps.length) * 100;

  if (!isVisible || !currentStep) {
    return hasCompletedOnboarding ? (
      <OnboardingTrigger onRestart={handleRestart} />
    ) : null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Getting Started with Nixbit</h2>
              <p className="text-indigo-100 text-sm">
                Step {progress.currentStep + 1} of {steps.length} • {currentStep.estimatedTime}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-indigo-100 hover:text-white p-2 rounded-full hover:bg-white hover:bg-opacity-20"
            >
              ✕
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4 bg-indigo-700 rounded-full h-2">
            <div
              className="bg-white rounded-full h-2 transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Step Navigation */}
        <div className="border-b border-gray-200 px-6 py-3">
          <div className="flex items-center space-x-2 overflow-x-auto">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs whitespace-nowrap ${
                  progress.completedSteps.includes(step.id)
                    ? 'bg-green-100 text-green-800'
                    : progress.skippedSteps.includes(step.id)
                    ? 'bg-gray-100 text-gray-600'
                    : index === progress.currentStep
                    ? 'bg-indigo-100 text-indigo-800'
                    : 'bg-gray-50 text-gray-500'
                }`}
              >
                {progress.completedSteps.includes(step.id) ? (
                  <CheckCircleIcon className="w-4 h-4" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-current opacity-20 flex items-center justify-center text-[10px] font-bold">
                    {index + 1}
                  </span>
                )}
                <span>{step.title}</span>
                {step.isOptional && (
                  <span className="text-xs opacity-60">(optional)</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto">
          <currentStep.component
            step={currentStep}
            onComplete={() => handleStepComplete(currentStep.id)}
            onSkip={currentStep.isOptional ? () => handleStepSkip(currentStep.id) : undefined}
          />
        </div>
      </div>
    </div>
  );
};

// Individual Step Components

const WelcomeStep: React.FC<OnboardingStepProps> = ({ onComplete, step }) => {
  return (
    <div className="p-8">
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-6">
          <span className="text-2xl">🚀</span>
        </div>
        
        <h3 className="text-2xl font-bold text-gray-900 mb-4">
          Welcome to Nixbit!
        </h3>
        
        <p className="text-lg text-gray-600 mb-8">
          We're excited to help you eliminate flaky tests and improve your CI/CD reliability.
          Let's get you set up in just a few minutes.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
              🔍
            </div>
            <h4 className="font-semibold text-gray-900">Detect Flaky Tests</h4>
            <p className="text-sm text-gray-600">AI-powered identification of unreliable tests</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
              🔒
            </div>
            <h4 className="font-semibold text-gray-900">Automatic Quarantine</h4>
            <p className="text-sm text-gray-600">Prevent flaky tests from blocking deployments</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
              📊
            </div>
            <h4 className="font-semibold text-gray-900">Actionable Insights</h4>
            <p className="text-sm text-gray-600">Understand patterns and improve test quality</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-8">
          <h4 className="font-semibold text-gray-900 mb-3">What we'll cover:</h4>
          <ul className="text-left text-sm text-gray-600 space-y-2">
            <li className="flex items-center">
              <CheckCircleIcon className="w-4 h-4 text-green-500 mr-2" />
              Set up your organization and invite team members
            </li>
            <li className="flex items-center">
              <CheckCircleIcon className="w-4 h-4 text-green-500 mr-2" />
              Connect your first project (GitHub, GitLab, or Jenkins)
            </li>
            <li className="flex items-center">
              <CheckCircleIcon className="w-4 h-4 text-green-500 mr-2" />
              Configure intelligent quarantine policies
            </li>
            <li className="flex items-center">
              <CheckCircleIcon className="w-4 h-4 text-green-500 mr-2" />
              Run your first test and see Nixbit in action
            </li>
          </ul>
        </div>

        <button
          onClick={onComplete}
          className="bg-indigo-600 text-white px-8 py-3 rounded-lg hover:bg-indigo-700 transition-colors flex items-center mx-auto"
        >
          Let's Get Started
          <ArrowRightIcon className="w-5 h-5 ml-2" />
        </button>
      </div>
    </div>
  );
};

const OrganizationSetupStep: React.FC<OnboardingStepProps> = ({ onComplete, step }) => {
  const [orgName, setOrgName] = useState('');
  const [inviteEmails, setInviteEmails] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('pro');

  const handleSubmit = async () => {
    // Here you would make API calls to create organization and send invites
    // For now, we'll simulate the API call
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Track the setup
      if (window.gtag) {
        window.gtag('event', 'organization_created', {
          plan: selectedPlan,
          team_size: inviteEmails.split(',').filter(email => email.trim()).length + 1
        });
      }
      
      onComplete();
    } catch (error) {
      console.error('Error setting up organization:', error);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-6">
            <span className="text-2xl">🏢</span>
          </div>
          
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Set Up Your Organization
          </h3>
          
          <p className="text-gray-600">
            Create your organization and invite your team members to get started together.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Organization Name
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Your Company Name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invite Team Members (Optional)
            </label>
            <textarea
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
              placeholder="Enter email addresses separated by commas"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              You can also invite team members later from the team settings page.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Choose Your Plan
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { id: 'free', name: 'Free', price: '$0', features: ['1 Project', '1,000 Test Results/month', 'Basic Analytics'] },
                { id: 'pro', name: 'Pro', price: '$49', features: ['5 Projects', '50,000 Test Results/month', 'Advanced AI Analysis', 'Quarantine Automation'] },
                { id: 'enterprise', name: 'Enterprise', price: '$199', features: ['Unlimited Projects', 'Unlimited Test Results', 'Priority Support', 'Custom Integrations'] }
              ].map(plan => (
                <div
                  key={plan.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedPlan === plan.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  <div className="text-center">
                    <h4 className="font-semibold text-gray-900">{plan.name}</h4>
                    <p className="text-2xl font-bold text-gray-900 my-2">{plan.price}</p>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {plan.features.map(feature => (
                        <li key={feature}>✓ {feature}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-8">
          <button className="text-gray-500 hover:text-gray-700">
            Skip for now
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={!orgName.trim()}
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center"
          >
            Create Organization
            <ArrowRightIcon className="w-5 h-5 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
};

const ProjectConnectionStep: React.FC<OnboardingStepProps> = ({ onComplete, step }) => {
  const [selectedPlatform, setSelectedPlatform] = useState<'github' | 'gitlab' | 'jenkins' | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const platforms = [
    {
      id: 'github' as const,
      name: 'GitHub',
      icon: '🐙',
      description: 'Connect your GitHub repositories with our official app',
      setupTime: '2 minutes',
      features: ['Automatic webhook setup', 'No manual configuration', 'Instant test result reporting']
    },
    {
      id: 'gitlab' as const,
      name: 'GitLab',
      icon: '🦊',
      description: 'Integrate with GitLab CI/CD pipelines',
      setupTime: '3 minutes',
      features: ['Webhook configuration', 'API token setup', 'Pipeline integration']
    },
    {
      id: 'jenkins' as const,
      name: 'Jenkins',
      icon: '👨‍💼',
      description: 'Connect your Jenkins builds and test results',
      setupTime: '5 minutes',
      features: ['Plugin installation', 'Build step configuration', 'Result reporting']
    }
  ];

  const handleConnect = async (platform: typeof selectedPlatform) => {
    setSelectedPlatform(platform);
    setIsConnecting(true);

    try {
      // Simulate connection process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Track the connection
      if (window.gtag) {
        window.gtag('event', 'project_connected', {
          platform: platform
        });
      }
      
      onComplete();
    } catch (error) {
      console.error('Error connecting project:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-6">
            <span className="text-2xl">🔌</span>
          </div>
          
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Connect Your First Project
          </h3>
          
          <p className="text-gray-600">
            Choose your CI/CD platform to start detecting flaky tests. Don't worry, setup is quick and easy!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {platforms.map(platform => (
            <div
              key={platform.id}
              className={`border rounded-xl p-6 cursor-pointer transition-all hover:shadow-lg ${
                selectedPlatform === platform.id
                  ? 'border-indigo-500 bg-indigo-50 shadow-lg'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => !isConnecting && setSelectedPlatform(platform.id)}
            >
              <div className="text-center">
                <div className="text-4xl mb-4">{platform.icon}</div>
                <h4 className="text-xl font-semibold text-gray-900 mb-2">{platform.name}</h4>
                <p className="text-sm text-gray-600 mb-4">{platform.description}</p>
                
                <div className="text-xs text-indigo-600 font-medium bg-indigo-100 rounded-full px-3 py-1 inline-block mb-4">
                  ⏱️ {platform.setupTime} setup
                </div>
                
                <ul className="text-xs text-gray-600 space-y-1 text-left">
                  {platform.features.map(feature => (
                    <li key={feature} className="flex items-center">
                      <CheckCircleIcon className="w-3 h-3 text-green-500 mr-2 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleConnect(platform.id);
                  }}
                  disabled={isConnecting}
                  className={`w-full mt-4 px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedPlatform === platform.id
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  {isConnecting && selectedPlatform === platform.id ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Connecting...
                    </div>
                  ) : (
                    `Connect ${platform.name}`
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="text-blue-500 mr-3 mt-1">💡</div>
            <div>
              <h4 className="font-medium text-blue-900 mb-1">Need help with integration?</h4>
              <p className="text-sm text-blue-700 mb-2">
                Our step-by-step guides will walk you through the entire process. You can also reach out to our support team for personalized assistance.
              </p>
              <div className="flex space-x-3">
                <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center">
                  <BookOpenIcon className="w-4 h-4 mr-1" />
                  View Integration Guide
                </button>
                <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center">
                  <VideoCameraIcon className="w-4 h-4 mr-1" />
                  Watch Video Tutorial
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Additional step components would be implemented similarly...
const ConfigurePoliciesStep: React.FC<OnboardingStepProps> = ({ onComplete, onSkip }) => {
  // Implementation for policy configuration
  return <div className="p-8">Policy configuration step...</div>;
};

const FirstTestRunStep: React.FC<OnboardingStepProps> = ({ onComplete }) => {
  // Implementation for first test run
  return <div className="p-8">First test run step...</div>;
};

const ExploreFeaturesStep: React.FC<OnboardingStepProps> = ({ onComplete }) => {
  // Implementation for feature exploration
  return <div className="p-8">Feature exploration step...</div>;
};

const SuccessCelebrationStep: React.FC<OnboardingStepProps> = ({ onComplete }) => {
  // Implementation for success celebration
  return <div className="p-8">Success celebration step...</div>;
};

// Onboarding trigger for completed users
const OnboardingTrigger: React.FC<{ onRestart: () => void }> = ({ onRestart }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-6 right-6 bg-indigo-600 text-white p-3 rounded-full shadow-lg hover:bg-indigo-700 transition-colors z-40"
        title="Restart Onboarding"
      >
        <PlayIcon className="w-5 h-5" />
      </button>

      {isVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Restart Onboarding?</h3>
            <p className="text-gray-600 mb-6">
              This will restart the onboarding flow from the beginning. This can be helpful if you want to review the setup process or invite new team members.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsVisible(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsVisible(false);
                  onRestart();
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Restart Onboarding
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OnboardingFlow;