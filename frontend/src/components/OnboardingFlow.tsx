import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, ArrowRight, Users, Zap, Target, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface OnboardingFlowProps {
  onComplete: () => void;
  userEmail?: string;
  utmData?: any;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  completed: boolean;
}

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, userEmail, utmData }) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Nixbit!',
      description: 'Your account has been created successfully. Let\'s get you set up to detect flaky tests.',
      icon: CheckCircle,
      completed: true
    },
    {
      id: 'team-setup',
      title: 'Set Up Your Team',
      description: 'Create your first organization and invite team members to collaborate.',
      icon: Users,
      completed: false
    },
    {
      id: 'first-project',
      title: 'Create Your First Project',
      description: 'Connect your repository and start tracking test reliability.',
      icon: Target,
      completed: false
    },
    {
      id: 'integration',
      title: 'Connect Your CI/CD',
      description: 'Set up webhooks to automatically receive test results.',
      icon: Zap,
      completed: false
    }
  ];

  const [onboardingSteps, setOnboardingSteps] = useState(steps);

  useEffect(() => {
    // Auto-advance welcome step after 2 seconds
    if (currentStep === 0) {
      const timer = setTimeout(() => {
        setCurrentStep(1);
        setOnboardingSteps(prev => prev.map((step, idx) => 
          idx === 0 ? { ...step, completed: true } : step
        ));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  const handleStepComplete = (stepIndex: number) => {
    setOnboardingSteps(prev => prev.map((step, idx) => 
      idx === stepIndex ? { ...step, completed: true } : step
    ));

    if (stepIndex < onboardingSteps.length - 1) {
      setCurrentStep(stepIndex + 1);
    } else {
      setIsComplete(true);
      setTimeout(() => onComplete(), 1500);
    }
  };

  const handleSkip = () => {
    setIsComplete(true);
    setTimeout(() => onComplete(), 500);
  };

  if (isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-xl shadow-xl p-8 max-w-lg w-full text-center"
        >
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You're All Set!</h2>
          <p className="text-gray-600 mb-6">
            Welcome to Nixbit. Let's start detecting those flaky tests and improving your development workflow.
          </p>
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
            <span className="ml-2 text-gray-600">Redirecting to dashboard...</span>
          </div>
        </motion.div>
      </div>
    );
  }

  const currentStepData = onboardingSteps[currentStep];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {onboardingSteps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                  step.completed ? 'bg-green-500 text-white' :
                  index === currentStep ? 'bg-indigo-600 text-white' :
                  'bg-gray-200 text-gray-600'
                }`}>
                  {step.completed ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < onboardingSteps.length - 1 && (
                  <div className={`w-16 h-1 mx-2 ${
                    step.completed ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Step {currentStep + 1} of {onboardingSteps.length}
            </p>
          </div>
        </div>

        {/* Main Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white rounded-xl shadow-xl overflow-hidden"
          >
            {/* Step Content */}
            <div className="p-8">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
                  <currentStepData.icon className="w-8 h-8 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {currentStepData.title}
                </h2>
                <p className="text-gray-600 max-w-2xl mx-auto">
                  {currentStepData.description}
                </p>
              </div>

              {/* Step-specific content */}
              {currentStep === 0 && (
                <div className="text-center">
                  <div className="mb-6">
                    <p className="text-lg text-gray-700 mb-2">
                      Hi {user?.name || user?.email?.split('@')[0] || 'there'}! 👋
                    </p>
                    <p className="text-gray-600">
                      Thanks for joining the beta. Let's get you started with detecting flaky tests.
                    </p>
                  </div>
                  {utmData && (
                    <div className="bg-blue-50 rounded-lg p-4 mb-6">
                      <p className="text-sm text-blue-800">
                        <strong>Referral source:</strong> {utmData.source || 'Direct'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {currentStep === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-2">Create Organization</h3>
                    <p className="text-gray-600 mb-4 text-sm">
                      Set up your team workspace to collaborate on test reliability improvements.
                    </p>
                    <button 
                      onClick={() => handleStepComplete(1)}
                      className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      Create Organization
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-2">Benefits</h3>
                    <ul className="text-sm text-gray-600 space-y-2">
                      <li className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        Team collaboration
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        Shared projects
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        Role-based access
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-2">Create Project</h3>
                    <p className="text-gray-600 mb-4 text-sm">
                      Connect your repository and start tracking test reliability metrics.
                    </p>
                    <button 
                      onClick={() => handleStepComplete(2)}
                      className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      Create Project
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-2">What You'll Get</h3>
                    <ul className="text-sm text-gray-600 space-y-2">
                      <li className="flex items-center">
                        <TrendingUp className="w-4 h-4 text-blue-500 mr-2" />
                        Test reliability metrics
                      </li>
                      <li className="flex items-center">
                        <Target className="w-4 h-4 text-red-500 mr-2" />
                        Flaky test detection
                      </li>
                      <li className="flex items-center">
                        <Zap className="w-4 h-4 text-yellow-500 mr-2" />
                        Automated retries
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-2">Setup Integration</h3>
                    <p className="text-gray-600 mb-4 text-sm">
                      Connect your CI/CD pipeline to automatically receive test results.
                    </p>
                    <button 
                      onClick={() => handleStepComplete(3)}
                      className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      Setup Webhooks
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-2">Supported Platforms</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                      <div>• GitHub Actions</div>
                      <div>• GitLab CI</div>
                      <div>• Jenkins</div>
                      <div>• CircleCI</div>
                      <div>• Travis CI</div>
                      <div>• Any custom CI</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="bg-gray-50 px-8 py-4 flex justify-between items-center">
              <button
                onClick={handleSkip}
                className="text-gray-500 hover:text-gray-700 font-medium"
              >
                Skip for now
              </button>
              <div className="flex items-center space-x-3">
                {currentStep > 0 && (
                  <button
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Back
                  </button>
                )}
                <div className="text-sm text-gray-500">
                  {Math.round(((currentStep + 1) / onboardingSteps.length) * 100)}% complete
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default OnboardingFlow;