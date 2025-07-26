import React from 'react'
import { motion } from 'framer-motion'

const TermsPage: React.FC = () => {
  const lastUpdated = 'January 26, 2025'

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
              Terms of Service
            </h1>
            <p className="text-lg text-gray-600">
              Last updated: {lastUpdated}
            </p>
          </div>

          {/* Content */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 lg:p-12">
            <div className="prose prose-lg max-w-none">
              
              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Agreement to Terms</h2>
                <p className="text-gray-600 mb-4">
                  These Terms of Service ("Terms") govern your use of Nixbit's AI-powered test reliability platform 
                  ("Service") operated by Nixbit ("we," "us," or "our"). By accessing or using our Service, 
                  you agree to be bound by these Terms.
                </p>
                <p className="text-gray-600">
                  If you disagree with any part of these Terms, then you may not access the Service.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Description of Service</h2>
                <p className="text-gray-600 mb-4">
                  Nixbit provides an AI-powered platform that:
                </p>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>Detects flaky tests in your CI/CD pipelines</li>
                  <li>Provides intelligent test retry logic and quarantine capabilities</li>
                  <li>Offers analytics and insights on test reliability</li>
                  <li>Integrates with popular CI/CD platforms and testing frameworks</li>
                  <li>Delivers notifications and reporting on test stability</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">User Accounts</h2>
                
                <h3 className="text-xl font-medium text-gray-800 mb-3">Account Creation</h3>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>You must provide accurate and complete information when creating an account</li>
                  <li>You are responsible for maintaining the security of your account credentials</li>
                  <li>You must promptly notify us of any unauthorized use of your account</li>
                  <li>One person or legal entity may not maintain more than one free account</li>
                </ul>

                <h3 className="text-xl font-medium text-gray-800 mb-3">Account Responsibilities</h3>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>You are responsible for all activities that occur under your account</li>
                  <li>You must not share your account credentials with others</li>
                  <li>You must comply with all applicable laws and regulations</li>
                  <li>You must not use the Service for any illegal or unauthorized purpose</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Acceptable Use</h2>
                <p className="text-gray-600 mb-4">You agree not to:</p>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>Upload malicious code, viruses, or harmful content</li>
                  <li>Attempt to gain unauthorized access to other users' data</li>
                  <li>Use the Service to violate any applicable laws or regulations</li>
                  <li>Reverse engineer, decompile, or disassemble the Service</li>
                  <li>Interfere with or disrupt the Service or servers</li>
                  <li>Use the Service for competitive analysis or to build competing products</li>
                  <li>Exceed reasonable request volumes or attempt to overload our systems</li>
                  <li>Remove or modify any proprietary notices or labels</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data and Privacy</h2>
                
                <h3 className="text-xl font-medium text-gray-800 mb-3">Your Data</h3>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>You retain ownership of your test data and intellectual property</li>
                  <li>You grant us license to process your data to provide the Service</li>
                  <li>You are responsible for ensuring you have rights to upload data to our Service</li>
                  <li>You must not upload sensitive personal information or secrets</li>
                </ul>

                <h3 className="text-xl font-medium text-gray-800 mb-3">Data Security</h3>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>We implement industry-standard security measures to protect your data</li>
                  <li>We will notify you of any security breaches affecting your data</li>
                  <li>You acknowledge that no method of transmission is 100% secure</li>
                  <li>You are responsible for maintaining backups of your important data</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Billing and Payment</h2>
                
                <h3 className="text-xl font-medium text-gray-800 mb-3">Subscription Plans</h3>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>Subscription fees are billed in advance on a monthly or annual basis</li>
                  <li>All fees are non-refundable except as expressly stated</li>
                  <li>You must provide valid payment information and authorize charges</li>
                  <li>Prices may change with 30 days' notice for new billing cycles</li>
                </ul>

                <h3 className="text-xl font-medium text-gray-800 mb-3">Usage Limits</h3>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>Each plan includes specific usage limits and features</li>
                  <li>Exceeding limits may result in additional charges or service restrictions</li>
                  <li>We will provide reasonable notice before enforcing limit restrictions</li>
                  <li>You can upgrade your plan at any time to increase limits</li>
                </ul>

                <h3 className="text-xl font-medium text-gray-800 mb-3">Cancellation</h3>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>You may cancel your subscription at any time</li>
                  <li>Cancellation takes effect at the end of your current billing period</li>
                  <li>No refunds for partial months or unused portions</li>
                  <li>Your data will be retained for 30 days after cancellation</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Service Availability</h2>
                <p className="text-gray-600 mb-4">
                  We strive to maintain high service availability, but we do not guarantee uninterrupted service:
                </p>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>Scheduled maintenance will be announced in advance when possible</li>
                  <li>Emergency maintenance may occur without notice</li>
                  <li>We target 99.5% uptime but do not provide SLA guarantees for free plans</li>
                  <li>Service interruptions may occur due to factors beyond our control</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Intellectual Property</h2>
                
                <h3 className="text-xl font-medium text-gray-800 mb-3">Our Rights</h3>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>Nixbit and all related marks are our trademarks</li>
                  <li>The Service and its original content are our intellectual property</li>
                  <li>Our algorithms and methodologies are proprietary and confidential</li>
                  <li>You may not use our trademarks without express written permission</li>
                </ul>

                <h3 className="text-xl font-medium text-gray-800 mb-3">Your Rights</h3>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>You retain all rights to your original content and data</li>
                  <li>You grant us license to use your data to provide and improve the Service</li>
                  <li>We may use aggregated, anonymized data for research and development</li>
                  <li>You may not claim ownership of any part of our Service or technology</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Limitation of Liability</h2>
                <p className="text-gray-600 mb-4">
                  To the maximum extent permitted by law:
                </p>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>Our total liability shall not exceed the amount you paid in the last 12 months</li>
                  <li>We are not liable for indirect, incidental, or consequential damages</li>
                  <li>We do not guarantee the accuracy or completeness of our analysis</li>
                  <li>You use the Service at your own risk and discretion</li>
                  <li>Some jurisdictions do not allow certain liability limitations</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Disclaimers</h2>
                <p className="text-gray-600 mb-4">
                  The Service is provided "as is" and "as available" without warranties of any kind:
                </p>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>We disclaim all warranties, express or implied</li>
                  <li>We do not warrant that the Service will be error-free or uninterrupted</li>
                  <li>AI-based analysis may not catch all flaky tests or may flag non-flaky tests</li>
                  <li>You should not rely solely on our Service for critical testing decisions</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Termination</h2>
                <p className="text-gray-600 mb-4">
                  We may terminate or suspend your account and access to the Service:
                </p>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>Immediately for violations of these Terms</li>
                  <li>For non-payment of fees after reasonable notice</li>
                  <li>If we reasonably believe you pose a security risk</li>
                  <li>Upon discontinuation of the Service with 30 days' notice</li>
                </ul>
                <p className="text-gray-600">
                  Upon termination, your right to use the Service ceases immediately.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Governing Law</h2>
                <p className="text-gray-600 mb-4">
                  These Terms are governed by and construed in accordance with the laws of [Your Jurisdiction], 
                  without regard to its conflict of law provisions. Any disputes arising from these Terms or 
                  the Service will be subject to the exclusive jurisdiction of the courts in [Your Jurisdiction].
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes to Terms</h2>
                <p className="text-gray-600 mb-4">
                  We reserve the right to modify these Terms at any time. We will notify users of any 
                  material changes by email and by posting the updated Terms on our website. 
                  Your continued use of the Service after changes constitutes acceptance of the new Terms.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Information</h2>
                <p className="text-gray-600 mb-4">
                  If you have any questions about these Terms of Service, please contact us:
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-600 mb-2"><strong>Email:</strong> legal@nixbit.dev</p>
                  <p className="text-gray-600 mb-2"><strong>Support:</strong> support@nixbit.dev</p>
                  <p className="text-gray-600"><strong>Address:</strong> [Your Business Address]</p>
                </div>
              </section>

            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default TermsPage