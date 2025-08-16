import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Rocket, Users, CheckCircle, ArrowRight,
  Shield, Zap, Target, Gift, Calendar, MessageSquare,
  Award, TrendingUp, Globe, Mail
} from 'lucide-react';
import { useMarketingSignup } from '../hooks/useMarketingSignup';
import Turnstile from '../components/Turnstile';
import { useCaptcha } from '../hooks/useCaptcha';

interface BetaApplication {
  email: string;
  name: string;
  company: string;
  role: string;
  teamSize: string;
  primaryUsage: string;
  experience: string;
  referralSource: string;
  linkedinProfile?: string;
  githubProfile?: string;
  motivation: string;
  expectations: string;
  availableTime: string;
  communicationPreference: string[];
}

const teamSizeOptions = [
  '1-5 developers',
  '6-15 developers', 
  '16-50 developers',
  '50+ developers'
];

const usageOptions = [
  'GitHub Actions',
  'GitLab CI',
  'Jenkins',
  'CircleCI',
  'Azure DevOps',
  'Other CI/CD system'
];

const experienceOptions = [
  'New to flaky test detection',
  'Some experience with test reliability',
  'Experienced with CI/CD optimization',
  'Expert in test automation'
];

const referralSources = [
  'Google Search',
  'Social Media (Twitter/LinkedIn)',
  'Developer Community (Reddit/Discord)',
  'Conference/Meetup',
  'Colleague Recommendation',
  'Blog/Newsletter',
  'Other'
];

export const BetaSignupPage: React.FC = () => {
  const { submitSignup, isSubmitting, isSuccess, error } = useMarketingSignup();
  // Use hook state instead of local state
  const loading = isSubmitting;
  const success = isSuccess;
  const { 
    captchaToken, 
    isCaptchaVerified, 
    captchaError, 
    handleCaptchaVerify, 
    handleCaptchaError, 
    handleCaptchaExpire,
    resetCaptcha 
  } = useCaptcha();
  const [formData, setFormData] = useState<BetaApplication>({
    email: '',
    name: '',
    company: '',
    role: '',
    teamSize: '',
    primaryUsage: '',
    experience: '',
    referralSource: '',
    linkedinProfile: '',
    githubProfile: '',
    motivation: '',
    expectations: '',
    availableTime: '',
    communicationPreference: [],
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [isValidStep, setIsValidStep] = useState(false);
  const totalSteps = 4;

  useEffect(() => {
    validateCurrentStep();
  }, [formData, currentStep]);

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        setIsValidStep(
          formData.email.includes('@') && 
          formData.name.trim().length > 0 && 
          formData.company.trim().length > 0 &&
          formData.role.trim().length > 0
        );
        break;
      case 2:
        setIsValidStep(
          formData.teamSize.length > 0 && 
          formData.primaryUsage.length > 0 && 
          formData.experience.length > 0
        );
        break;
      case 3:
        setIsValidStep(
          formData.motivation.trim().length > 20 && 
          formData.expectations.trim().length > 10
        );
        break;
      case 4:
        setIsValidStep(
          formData.availableTime.length > 0 && 
          formData.communicationPreference.length > 0 &&
          formData.referralSource.length > 0 &&
          isCaptchaVerified
        );
        break;
      default:
        setIsValidStep(false);
    }
  };

  const handleInputChange = (field: keyof BetaApplication, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (field: keyof BetaApplication, value: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: checked 
        ? [...(prev[field] as string[]), value]
        : (prev[field] as string[]).filter(item => item !== value)
    }));
  };

  const nextStep = () => {
    if (isValidStep && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidStep && isCaptchaVerified) {
      try {
        await submitSignup({
          email: formData.email,
          name: formData.name,
          company: formData.company,
          teamSize: formData.teamSize as "1-5" | "6-15" | "16-50" | "50+",
          currentPainPoints: [formData.motivation],
          interestedFeatures: [formData.primaryUsage],
          captchaToken: captchaToken || undefined
        });
      } catch (err) {
        console.error('Submission error:', err);
        resetCaptcha(); // Reset CAPTCHA on error
      }
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
        <motion.div
          className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 text-center"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            🎉 You're In!
          </h1>
          
          <p className="text-lg text-gray-600 mb-6">
            Welcome to the Nixbit Beta Program! We're excited to have you on board.
          </p>
          
          <div className="bg-indigo-50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-indigo-900 mb-3">What happens next?</h3>
            <div className="space-y-3 text-sm text-indigo-700">
              <div className="flex items-start space-x-3">
                <Mail className="h-5 w-5 mt-0.5 text-indigo-500" />
                <span>You'll receive a welcome email with your beta access credentials within 24 hours</span>
              </div>
              <div className="flex items-start space-x-3">
                <MessageSquare className="h-5 w-5 mt-0.5 text-indigo-500" />
                <span>We'll invite you to our exclusive beta tester community</span>
              </div>
              <div className="flex items-start space-x-3">
                <Calendar className="h-5 w-5 mt-0.5 text-indigo-500" />
                <span>Get ready for weekly check-ins and feedback sessions</span>
              </div>
              <div className="flex items-start space-x-3">
                <Gift className="h-5 w-5 mt-0.5 text-indigo-500" />
                <span>Enjoy exclusive perks and early access to new features</span>
              </div>
            </div>
          </div>
          
          <p className="text-sm text-gray-500 mb-6">
            Beta Program Duration: 8 weeks • Expected Start: Next Monday
          </p>
          
          <div className="flex justify-center space-x-4">
            <a
              href="/"
              className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Back to Home
            </a>
            <a
              href="mailto:beta@nixbit.dev"
              className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Contact Us
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Hero Section */}
      <div className="relative pt-20 pb-16">
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.div
              className="inline-flex items-center px-4 py-2 bg-white bg-opacity-10 rounded-full text-white text-sm font-medium mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Rocket className="h-4 w-4 mr-2" />
              Limited Beta Program • 25-30 Exclusive Spots
            </motion.div>
            
            <motion.h1
              className="text-5xl md:text-6xl font-bold text-white mb-6"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              Join the Future of
              <span className="block bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Flaky Test Detection
              </span>
            </motion.h1>
            
            <motion.p
              className="text-xl text-gray-200 mb-8 max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Get exclusive early access to Nixbit's AI-powered platform that eliminates flaky tests 
              and saves your team 2-5 hours per week. Join elite developers shaping the future of CI/CD reliability.
            </motion.p>

            <motion.div
              className="flex justify-center space-x-8 text-white mb-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-green-400" />
                <span className="text-sm">94% Accuracy</span>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-yellow-400" />
                <span className="text-sm">5-min Setup</span>
              </div>
              <div className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-blue-400" />
                <span className="text-sm">AI-Powered</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Beta Program Benefits */}
      <motion.div
        className="relative bg-white bg-opacity-10 backdrop-blur-sm py-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.8 }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Exclusive Beta Benefits
            </h2>
            <p className="text-gray-200 text-lg">
              Shape the product while enjoying exclusive perks
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Gift,
                title: 'Free Beta Access',
                description: 'Full platform access (normally $29-99/month) throughout the 8-week program',
                color: 'text-green-400'
              },
              {
                icon: Award,
                title: 'Lifetime Discount',
                description: '50% off your first year subscription when we launch publicly',
                color: 'text-purple-400'
              },
              {
                icon: TrendingUp,
                title: 'Early Access',
                description: 'Get new features 30 days before general release + priority support',
                color: 'text-blue-400'
              },
              {
                icon: Users,
                title: 'Direct Impact',
                description: 'Weekly 1:1 calls with our team + your feedback shapes the roadmap',
                color: 'text-cyan-400'
              },
              {
                icon: MessageSquare,
                title: 'Exclusive Community',
                description: 'Private Slack workspace + Discord server with fellow beta testers',
                color: 'text-pink-400'
              },
              {
                icon: Globe,
                title: 'Recognition',
                description: 'Public testimonial opportunities + case study participation ($200 bonus)',
                color: 'text-yellow-400'
              }
            ].map((benefit, index) => (
              <motion.div
                key={benefit.title}
                className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6 border border-white border-opacity-20"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1 + index * 0.1 }}
              >
                <benefit.icon className={`h-8 w-8 ${benefit.color} mb-4`} />
                <h3 className="text-lg font-semibold text-white mb-2">{benefit.title}</h3>
                <p className="text-gray-300 text-sm">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Application Form */}
      <div className="relative py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="bg-white rounded-2xl shadow-2xl overflow-hidden"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.5 }}
          >
            {/* Progress Bar */}
            <div className="bg-gray-50 px-8 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">
                  Step {currentStep} of {totalSteps}
                </span>
                <span className="text-sm text-gray-500">
                  {Math.round((currentStep / totalSteps) * 100)}% Complete
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                ></div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8">
              {/* Step 1: Basic Information */}
              {currentStep === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">
                    Let's get to know you
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="your.email@company.com"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="John Smith"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Company *
                      </label>
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => handleInputChange('company', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Acme Corp"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Role *
                      </label>
                      <input
                        type="text"
                        value={formData.role}
                        onChange={(e) => handleInputChange('role', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Senior Developer / DevOps Engineer"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 mt-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        LinkedIn Profile (Optional)
                      </label>
                      <input
                        type="url"
                        value={formData.linkedinProfile}
                        onChange={(e) => handleInputChange('linkedinProfile', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="https://linkedin.com/in/yourprofile"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        GitHub Profile (Optional)
                      </label>
                      <input
                        type="url"
                        value={formData.githubProfile}
                        onChange={(e) => handleInputChange('githubProfile', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="https://github.com/yourusername"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Technical Background */}
              {currentStep === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">
                    Tell us about your setup
                  </h3>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Team Size *
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {teamSizeOptions.map((option) => (
                          <label key={option} className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="radio"
                              name="teamSize"
                              value={option}
                              checked={formData.teamSize === option}
                              onChange={(e) => handleInputChange('teamSize', e.target.value)}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-700">{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Primary CI/CD System *
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {usageOptions.map((option) => (
                          <label key={option} className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="radio"
                              name="primaryUsage"
                              value={option}
                              checked={formData.primaryUsage === option}
                              onChange={(e) => handleInputChange('primaryUsage', e.target.value)}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-700">{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Experience Level *
                      </label>
                      <div className="space-y-3">
                        {experienceOptions.map((option) => (
                          <label key={option} className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="radio"
                              name="experience"
                              value={option}
                              checked={formData.experience === option}
                              onChange={(e) => handleInputChange('experience', e.target.value)}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-700">{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Motivation & Expectations */}
              {currentStep === 3 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">
                    Why do you want to join?
                  </h3>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        What's your motivation for joining the beta? *
                      </label>
                      <textarea
                        rows={4}
                        value={formData.motivation}
                        onChange={(e) => handleInputChange('motivation', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Tell us about your current challenges with flaky tests, what you hope to achieve, and why you're interested in this beta program..."
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Minimum 20 characters</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        What do you expect from this beta experience? *
                      </label>
                      <textarea
                        rows={3}
                        value={formData.expectations}
                        onChange={(e) => handleInputChange('expectations', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="What outcomes are you hoping for? How will you measure success?"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Minimum 10 characters</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 4: Commitment & Communication */}
              {currentStep === 4 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">
                    Final details
                  </h3>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        How much time can you commit per week? *
                      </label>
                      <div className="space-y-2">
                        {[
                          '1-2 hours (Light testing)',
                          '3-5 hours (Regular testing)', 
                          '6-10 hours (Heavy testing)',
                          '10+ hours (Power user)'
                        ].map((option) => (
                          <label key={option} className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="radio"
                              name="availableTime"
                              value={option}
                              checked={formData.availableTime === option}
                              onChange={(e) => handleInputChange('availableTime', e.target.value)}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-700">{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Preferred communication channels * (Select all that apply)
                      </label>
                      <div className="space-y-2">
                        {[
                          'Email updates',
                          'Slack workspace',
                          'Discord community',
                          'Weekly video calls',
                          '1:1 feedback sessions'
                        ].map((option) => (
                          <label key={option} className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.communicationPreference.includes(option)}
                              onChange={(e) => handleCheckboxChange('communicationPreference', option, e.target.checked)}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-700">{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        How did you hear about us? *
                      </label>
                      <select
                        value={formData.referralSource}
                        onChange={(e) => handleInputChange('referralSource', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      >
                        <option value="">Select source</option>
                        {referralSources.map((source) => (
                          <option key={source} value={source}>{source}</option>
                        ))}
                      </select>
                    </div>

                    {/* CAPTCHA */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Security Verification *
                      </label>
                      <Turnstile
                        siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAAiUl7SBtNg-xG1_'}
                        onVerify={handleCaptchaVerify}
                        onError={handleCaptchaError}
                        onExpire={handleCaptchaExpire}
                        theme="auto"
                        className="flex justify-center"
                      />
                      {captchaError && (
                        <p className="text-sm text-red-600 mt-2">{captchaError}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {error && (
                <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="text-sm text-red-700">{error.message || 'An error occurred'}</div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="px-6 py-3 text-gray-600 font-medium hover:text-gray-800 transition-colors"
                  >
                    ← Previous
                  </button>
                )}
                
                <div className="flex-1"></div>

                {currentStep < totalSteps ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    disabled={!isValidStep}
                    className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                  >
                    <span>Next</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!isValidStep || loading}
                    className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Rocket className="h-4 w-4" />
                    )}
                    <span>{loading ? 'Submitting...' : 'Join Beta Program'}</span>
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        </div>
      </div>

      {/* Trust Indicators */}
      <div className="relative py-16 bg-white bg-opacity-5 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-300 mb-8">
            Trusted by developers at leading companies
          </p>
          <div className="flex justify-center items-center space-x-12 opacity-60">
            {/* Mock company logos */}
            <div className="text-white font-bold text-lg">TechCorp</div>
            <div className="text-white font-bold text-lg">StartupCo</div>
            <div className="text-white font-bold text-lg">DevTeam</div>
            <div className="text-white font-bold text-lg">CloudSoft</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BetaSignupPage;