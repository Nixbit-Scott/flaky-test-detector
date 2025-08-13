import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle, Zap } from 'lucide-react'

const CTASection: React.FC = () => {
  const benefits = [
    'Free beta access',
    '5-minute setup',
    'No credit card required',
    'Cancel anytime'
  ]

  return (
    <section className="bg-gradient-to-br from-primary-600 to-primary-800 section-padding relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-72 h-72 bg-white rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-white rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse-slow animation-delay-2000"></div>
      </div>

      <div className="relative container-custom text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 bg-white/20 text-white px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Zap className="h-4 w-4" />
            <span>Limited Beta Access</span>
          </div>

          {/* Headline */}
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6 leading-tight">
            Ready to{' '}
            <span className="text-primary-200">Nix the Flaky?</span>
          </h2>

          <p className="text-xl text-primary-100 mb-8 max-w-3xl mx-auto leading-relaxed">
            Join 50+ development teams already saving 5+ hours weekly with Nixbit's 
            AI-powered flaky test detection. Start your free beta access today.
          </p>

          {/* Benefits */}
          <div className="flex flex-wrap justify-center gap-6 mb-10">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                className="flex items-center space-x-2 text-primary-100"
              >
                <CheckCircle className="h-5 w-5 text-success-400" />
                <span className="font-medium">{benefit}</span>
              </motion.div>
            ))}
          </div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-8"
          >
            <a
              href="/beta-signup.html"
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-primary-600 bg-white rounded-lg shadow-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-all duration-200 group"
            >
              Start Free Beta
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </a>
            
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white border-2 border-white/30 rounded-lg hover:border-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-all duration-200"
            >
              View Pricing
            </Link>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-8 text-primary-200"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">SOC 2 Compliant</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">GDPR Ready</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">99.9% Uptime SLA</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

export default CTASection