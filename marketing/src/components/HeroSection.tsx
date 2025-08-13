import React from 'react'
import { motion } from 'framer-motion'
import { Play, CheckCircle, ArrowRight, Zap, Shield, Clock } from 'lucide-react'

const HeroSection: React.FC = () => {
  const benefits = [
    'AI-powered flaky test detection',
    'Save 5+ hours per developer weekly',
    'Automatic test quarantine & retry logic',
    'Real-time CI/CD integration'
  ]

  return (
    <section className="relative bg-gradient-to-br from-primary-50 via-white to-primary-50 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-72 h-72 bg-primary-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse-slow"></div>
        <div className="absolute top-0 right-0 w-72 h-72 bg-success-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse-slow animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-primary-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse-slow animation-delay-4000"></div>
      </div>

      <div className="relative container-custom section-padding">
        <div className="lg:grid lg:grid-cols-12 lg:gap-16 items-center">
          {/* Hero Content */}
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              {/* Beta Badge */}
              <div className="inline-flex items-center space-x-2 bg-primary-100 text-primary-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Zap className="h-4 w-4" />
                <span>Now in Beta - Limited Access</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
                Nix the Flaky,{' '}
                <span className="gradient-text">Ship with Confidence</span>
              </h1>

              {/* Subheadline */}
              <p className="text-xl text-gray-600 leading-relaxed mb-8 max-w-2xl">
                Nixbit eliminates flaky tests with AI-powered detection. Automatically identify, 
                quarantine, and fix unreliable tests in your CI/CD pipeline. Join 50+ teams already 
                saving 5+ hours weekly.
              </p>

              {/* Benefits List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={benefit}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                    className="flex items-center space-x-3"
                  >
                    <CheckCircle className="h-5 w-5 text-success-500 flex-shrink-0" />
                    <span className="text-gray-700">{benefit}</span>
                  </motion.div>
                ))}
              </div>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
                className="flex flex-col sm:flex-row gap-4 mb-8"
              >
                <a
                  href="/beta-signup.html"
                  className="btn-primary btn-large group"
                >
                  Start Free Beta
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </a>
                
                <button className="btn-outline btn-large group">
                  <Play className="mr-2 h-5 w-5" />
                  Watch Demo
                </button>
              </motion.div>

              {/* Trust Indicators */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 1 }}
                className="flex items-center space-x-6 text-sm text-gray-500"
              >
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4" />
                  <span>SOC 2 Compliant</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4" />
                  <span>5-minute setup</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4" />
                  <span>Free beta access</span>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Hero Visual */}
          <div className="lg:col-span-5 mt-12 lg:mt-0">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="relative"
            >
              {/* Dashboard Preview */}
              <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                {/* Browser Bar */}
                <div className="bg-gray-100 px-4 py-3 flex items-center space-x-2">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  </div>
                  <div className="flex-1 bg-white rounded-md px-3 py-1 text-sm text-gray-500">
                    app.nixbit.dev
                  </div>
                </div>

                {/* Dashboard Content */}
                <div className="p-6">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">94%</div>
                      <div className="text-xs text-green-700">Stable Tests</div>
                    </div>
                    <div className="bg-gradient-to-r from-red-50 to-red-100 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">12</div>
                      <div className="text-xs text-red-700">Flaky Tests</div>
                    </div>
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">5.2h</div>
                      <div className="text-xs text-blue-700">Time Saved</div>
                    </div>
                  </div>

                  {/* Chart Area */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="h-24 bg-gradient-to-r from-primary-200 to-primary-400 rounded opacity-60"></div>
                  </div>

                  {/* Action Items */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                      <span className="text-sm font-medium text-red-800">UserService.test.js</span>
                      <span className="text-xs text-red-600 bg-red-200 px-2 py-1 rounded">Quarantined</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-yellow-50 rounded-lg">
                      <span className="text-sm font-medium text-yellow-800">AuthController.test.js</span>
                      <span className="text-xs text-yellow-600 bg-yellow-200 px-2 py-1 rounded">Monitoring</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Elements */}
              <motion.div
                animate={{ y: [-10, 10, -10] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute -top-4 -right-4 bg-success-500 text-white p-3 rounded-full shadow-lg"
              >
                <CheckCircle className="h-6 w-6" />
              </motion.div>

              <motion.div
                animate={{ y: [10, -10, 10] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute -bottom-4 -left-4 bg-primary-500 text-white p-3 rounded-full shadow-lg"
              >
                <Zap className="h-6 w-6" />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroSection