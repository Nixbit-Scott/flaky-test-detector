import React from 'react'
import { motion } from 'framer-motion'

const PrivacyPage: React.FC = () => {
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
              Privacy Policy
            </h1>
            <p className="text-lg text-gray-600">
              Last updated: {lastUpdated}
            </p>
          </div>

          {/* Content */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 lg:p-12">
            <div className="prose prose-lg max-w-none">
              
              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Introduction</h2>
                <p className="text-gray-600 mb-4">
                  Nixbit ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, 
                  use, disclose, and safeguard your information when you use our AI-powered test reliability platform and related services.
                </p>
                <p className="text-gray-600">
                  By using Nixbit, you agree to the collection and use of information in accordance with this Privacy Policy.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Information We Collect</h2>
                
                <h3 className="text-xl font-medium text-gray-800 mb-3">Personal Information</h3>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>Name and email address when you create an account</li>
                  <li>Company name and team size for service customization</li>
                  <li>Payment information processed securely by third-party providers</li>
                  <li>Communications with our support team</li>
                </ul>

                <h3 className="text-xl font-medium text-gray-800 mb-3">Technical Information</h3>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>Test result data and CI/CD pipeline information you provide</li>
                  <li>Usage data about how you interact with our platform</li>
                  <li>Device information, IP address, and browser type</li>
                  <li>Cookies and similar tracking technologies</li>
                </ul>

                <h3 className="text-xl font-medium text-gray-800 mb-3">Test Data</h3>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>Test names, suite names, and execution results</li>
                  <li>Error messages and stack traces (sanitized of sensitive data)</li>
                  <li>CI/CD metadata and build information</li>
                  <li>Repository URLs and branch information (metadata only)</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">How We Use Your Information</h2>
                <p className="text-gray-600 mb-4">We use the collected information to:</p>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>Provide, maintain, and improve our flaky test detection services</li>
                  <li>Analyze test patterns and provide AI-powered insights</li>
                  <li>Process payments and manage your account</li>
                  <li>Send service updates, security alerts, and support messages</li>
                  <li>Respond to your comments, questions, and requests</li>
                  <li>Monitor and analyze usage trends to improve our platform</li>
                  <li>Comply with legal obligations and enforce our terms</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Security and Protection</h2>
                <p className="text-gray-600 mb-4">
                  We implement appropriate technical and organizational security measures to protect your information:
                </p>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>Encryption in transit and at rest using industry-standard protocols</li>
                  <li>Regular security audits and vulnerability assessments</li>
                  <li>Access controls and authentication mechanisms</li>
                  <li>Data anonymization and sanitization procedures</li>
                  <li>Secure data centers with 24/7 monitoring</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Sharing and Disclosure</h2>
                <p className="text-gray-600 mb-4">
                  We do not sell, trade, or otherwise transfer your personal information to third parties except:
                </p>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>With your explicit consent</li>
                  <li>To trusted service providers who assist in operating our platform</li>
                  <li>When required by law or to protect our rights and safety</li>
                  <li>In connection with a merger, acquisition, or asset sale (with notice)</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Retention</h2>
                <p className="text-gray-600 mb-4">
                  We retain your information only as long as necessary to provide our services and comply with legal obligations:
                </p>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>Account data: Retained while your account is active plus 2 years</li>
                  <li>Test data: Retained for analysis purposes up to 3 years</li>
                  <li>Aggregated analytics: May be retained indefinitely in anonymized form</li>
                  <li>Support communications: Retained for 5 years for quality purposes</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your Rights</h2>
                <p className="text-gray-600 mb-4">
                  Depending on your location, you may have the following rights regarding your personal information:
                </p>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li><strong>Access:</strong> Request a copy of your personal data</li>
                  <li><strong>Rectification:</strong> Correct inaccurate or incomplete information</li>
                  <li><strong>Erasure:</strong> Request deletion of your personal data</li>
                  <li><strong>Portability:</strong> Receive your data in a structured format</li>
                  <li><strong>Restriction:</strong> Limit how we process your information</li>
                  <li><strong>Objection:</strong> Object to processing based on legitimate interests</li>
                </ul>
                <p className="text-gray-600">
                  To exercise these rights, please contact us at privacy@nixbit.dev.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Cookies and Tracking</h2>
                <p className="text-gray-600 mb-4">
                  We use cookies and similar technologies to enhance your experience:
                </p>
                <ul className="text-gray-600 mb-4 list-disc pl-6">
                  <li>Essential cookies for platform functionality</li>
                  <li>Analytics cookies to understand usage patterns</li>
                  <li>Preference cookies to remember your settings</li>
                </ul>
                <p className="text-gray-600">
                  You can control cookie preferences through your browser settings.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">International Transfers</h2>
                <p className="text-gray-600 mb-4">
                  Your information may be transferred to and processed in countries other than your own. 
                  We ensure appropriate safeguards are in place to protect your data during international transfers, 
                  including standard contractual clauses and adequacy decisions.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Children's Privacy</h2>
                <p className="text-gray-600 mb-4">
                  Nixbit is not intended for individuals under the age of 18. We do not knowingly collect 
                  personal information from children under 18. If we become aware that we have collected 
                  such information, we will take steps to delete it promptly.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes to This Policy</h2>
                <p className="text-gray-600 mb-4">
                  We may update this Privacy Policy from time to time. We will notify you of any changes by 
                  posting the new Privacy Policy on this page and updating the "Last updated" date. 
                  For significant changes, we will provide additional notice via email.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
                <p className="text-gray-600 mb-4">
                  If you have any questions about this Privacy Policy or our privacy practices, please contact us:
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-600 mb-2"><strong>Email:</strong> privacy@nixbit.dev</p>
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

export default PrivacyPage