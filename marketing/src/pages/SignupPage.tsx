import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, ArrowRight, AlertCircle } from 'lucide-react'
import { useMarketingSignup } from '../hooks/useMarketingSignup'
import { initializeUTMTracking } from '../utils/utm'

const SignupPage: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    company: '',
    teamSize: '1-5' as const,
  });
  const [showSuccess, setShowSuccess] = useState(false);

  // Initialize UTM tracking on component mount
  useEffect(() => {
    initializeUTMTracking();
  }, []);

  const { submitSignup, isSubmitting, isError, error, data } = useMarketingSignup({
    onSuccess: (response) => {
      if (response.success) {
        setShowSuccess(true);
        // Reset form
        setFormData({
          email: '',
          name: '',
          company: '',
          teamSize: '1-5',
        });
      }
    },
    onError: (error) => {
      console.error('Signup error:', error);
    }
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email.trim()) {
      return;
    }

    submitSignup({
      email: formData.email.trim(),
      name: formData.name.trim() || undefined,
      company: formData.company.trim() || undefined,
      teamSize: formData.teamSize,
    });
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center"
          >
            <div className="mb-6">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-success-100">
                <CheckCircle className="h-8 w-8 text-success-600" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Welcome to the Beta!
            </h2>
            
            <p className="text-gray-600 mb-6">
              Thank you for your interest in Nixbit. We'll be in touch soon with beta access details.
            </p>
            
            <div className="space-y-4">
              <Link
                to="/"
                className="w-full btn-primary"
              >
                Back to Home
              </Link>
              
              <button
                onClick={() => setShowSuccess(false)}
                className="w-full btn-outline"
              >
                Sign Up Another User
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Start Your Free Beta
          </h2>
          <p className="text-gray-600">
            Join 50+ teams already saving hours weekly
          </p>
        </motion.div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10"
        >
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Error Message */}
            {(isError || (data && !data.success)) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center"
              >
                <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
                <div className="text-sm text-red-700">
                  {data?.message || error?.message || 'Something went wrong. Please try again.'}
                </div>
              </motion.div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address *
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="you@company.com"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Your name
              </label>
              <div className="mt-1">
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="given-name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Your Name"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <label htmlFor="company" className="block text-sm font-medium text-gray-700">
                Company name
              </label>
              <div className="mt-1">
                <input
                  id="company"
                  name="company"
                  type="text"
                  autoComplete="organization"
                  value={formData.company}
                  onChange={handleInputChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Your Company"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <label htmlFor="teamSize" className="block text-sm font-medium text-gray-700">
                Team size
              </label>
              <div className="mt-1">
                <select
                  id="teamSize"
                  name="teamSize"
                  value={formData.teamSize}
                  onChange={handleInputChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  disabled={isSubmitting}
                >
                  <option value="1-5">1-5 developers</option>
                  <option value="6-15">6-15 developers</option>
                  <option value="16-50">16-50 developers</option>
                  <option value="50+">50+ developers</option>
                </select>
              </div>
            </div>

            {/* Privacy Consent */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-xs text-gray-600 text-center">
                By requesting beta access, you agree to our{' '}
                <Link to="/terms" className="text-primary-600 hover:text-primary-500 underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-primary-600 hover:text-primary-500 underline">
                  Privacy Policy
                </Link>
                . We'll send you product updates and beta access information.
              </p>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting || !formData.email.trim()}
                className="w-full btn-primary group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    Request Beta Access
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                Already have beta access?{' '}
                <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
                  Sign in to dashboard
                </Link>
              </p>
            </div>

            <div className="text-center text-xs text-gray-500">
              <p>
                By signing up, you agree to receive marketing emails from Nixbit.
                You can unsubscribe at any time.
              </p>
            </div>
          </form>

          {/* Benefits */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-900 mb-3">What you get:</p>
            <div className="space-y-2">
              {[
                'Free beta access',
                '5-minute setup',
                'AI-powered detection',
                'Email support'
              ].map((benefit) => (
                <div key={benefit} className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-success-500 mr-2" />
                  {benefit}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default SignupPage