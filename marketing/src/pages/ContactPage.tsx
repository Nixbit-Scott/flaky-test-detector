import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, MessageSquare, HelpCircle, Shield, FileText, Clock } from 'lucide-react'
import { useMarketingSignup } from '../hooks/useMarketingSignup'
import HCaptcha from '../components/HCaptcha'
import { useCaptcha } from '../hooks/useCaptcha'

const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    type: 'general' as 'general' | 'support' | 'legal' | 'sales'
  })

  const { submitSignup, isSubmitting } = useMarketingSignup({
    onSuccess: () => {
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: '',
        type: 'general'
      })
      resetCaptcha()
    }
  })

  const { 
    captchaToken, 
    isCaptchaVerified, 
    captchaError, 
    handleCaptchaVerify, 
    handleCaptchaError, 
    handleCaptchaExpire,
    resetCaptcha 
  } = useCaptcha()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isCaptchaVerified) {
      return
    }
    // For now, use the marketing signup endpoint to capture contact requests
    submitSignup({
      email: formData.email,
      name: formData.name,
      company: `Contact: ${formData.subject}`,
      captchaToken: captchaToken || undefined
    })
  }

  const contactTypes = [
    {
      id: 'general',
      name: 'General Inquiry',
      icon: MessageSquare,
      description: 'Questions about our platform or services'
    },
    {
      id: 'support',
      name: 'Technical Support',
      icon: HelpCircle,
      description: 'Help with using Nixbit or technical issues'
    },
    {
      id: 'legal',
      name: 'Legal & Privacy',
      icon: Shield,
      description: 'Privacy, terms, or legal concerns'
    },
    {
      id: 'sales',
      name: 'Sales & Partnerships',
      icon: FileText,
      description: 'Enterprise plans or partnership opportunities'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="container-custom">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Contact Us
            </h1>
            <p className="text-lg text-gray-600">
              We're here to help. Get in touch with our team.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
            >
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">Send us a message</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Contact Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    What can we help you with?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {contactTypes.map((type) => {
                      const Icon = type.icon
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, type: type.id as any }))}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            formData.type === type.id
                              ? 'border-primary-500 bg-primary-50 text-primary-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Icon className="h-5 w-5 mb-2" />
                          <div className="text-sm font-medium">{type.name}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                {/* Subject */}
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                {/* CAPTCHA */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Security Verification *
                  </label>
                  <HCaptcha
                    siteKey={import.meta.env.VITE_HCAPTCHA_SITE_KEY || '884a8fb6-2f40-459b-83c6-4e0c4d360ef6'}
                    onVerify={handleCaptchaVerify}
                    onError={handleCaptchaError}
                    onExpire={handleCaptchaExpire}
                    className="flex justify-center"
                  />
                  {captchaError && (
                    <p className="text-sm text-red-600 mt-2">{captchaError}</p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting || !isCaptchaVerified}
                  className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </motion.div>

            {/* Contact Information */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="space-y-8"
            >
              {/* Direct Contact */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Get in touch directly</h3>
                
                <div className="space-y-4">
                  <div className="flex items-start space-x-4">
                    <Mail className="h-6 w-6 text-primary-600 mt-1" />
                    <div>
                      <div className="font-medium text-gray-900">Sales Enquiries</div>
                      <div className="text-gray-600">sales@nixbit.dev</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <HelpCircle className="h-6 w-6 text-primary-600 mt-1" />
                    <div>
                      <div className="font-medium text-gray-900">Technical Support</div>
                      <div className="text-gray-600">support@nixbit.dev</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <Shield className="h-6 w-6 text-primary-600 mt-1" />
                    <div>
                      <div className="font-medium text-gray-900">Privacy & Legal</div>
                      <div className="text-gray-600">legal@nixbit.dev</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Response Times */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Response times</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-green-500" />
                    <div>
                      <div className="font-medium text-gray-900">General inquiries</div>
                      <div className="text-sm text-gray-600">Within 24 hours</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-blue-500" />
                    <div>
                      <div className="font-medium text-gray-900">Technical support</div>
                      <div className="text-sm text-gray-600">Within 4 hours</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-orange-500" />
                    <div>
                      <div className="font-medium text-gray-900">Legal matters</div>
                      <div className="text-sm text-gray-600">Within 48 hours</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Legal Notice */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h4 className="font-medium text-gray-900 mb-2">Legal & Privacy</h4>
                <p className="text-sm text-gray-600 mb-3">
                  For legal matters, privacy concerns, or data protection questions, 
                  please contact our legal team directly.
                </p>
                <p className="text-xs text-gray-500">
                  All communications are confidential and will be handled according to our 
                  Privacy Policy and applicable data protection laws.
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default ContactPage