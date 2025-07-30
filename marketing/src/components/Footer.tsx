import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Zap, Github, Twitter, Linkedin } from 'lucide-react'
import { marketingApi } from '../services/api'

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear()
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')

  const footerLinks = {
    product: [
      { name: 'Features', href: '/features' },
      { name: 'Pricing', href: '/pricing' },
      { name: 'API Documentation', href: '/docs' },
      { name: 'Integrations', href: '/integrations' },
    ],
    company: [
      { name: 'About', href: '/about' },
      { name: 'Contact', href: '/contact' },
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' },
    ],
    resources: [
      { name: 'Blog', href: '/blog' },
      { name: 'Help Center', href: '/help' },
      { name: 'Community', href: '/community' },
      { name: 'Status', href: '/status' },
    ],
  }

  const socialLinks = [
    { name: 'GitHub', icon: Github, href: 'https://github.com' },
    { name: 'Twitter', icon: Twitter, href: 'https://twitter.com' },
    { name: 'LinkedIn', icon: Linkedin, href: 'https://linkedin.com' },
  ]

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim()) {
      setMessage('Please enter your email address')
      setMessageType('error')
      return
    }

    setIsSubmitting(true)
    setMessage('')
    
    try {
      const response = await marketingApi.submitSignup({
        email: email.trim(),
        source: 'footer-newsletter',
        utmParameters: {
          utm_source: 'website',
          utm_medium: 'footer',
          utm_campaign: 'newsletter'
        }
      })
      
      if (response.success) {
        setMessage('Thanks for subscribing! We\'ll keep you updated on new features and blog posts.')
        setMessageType('success')
        setEmail('')
      } else {
        setMessage(response.message || 'Something went wrong. Please try again.')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Newsletter signup error:', error)
      setMessage('Failed to subscribe. Please try again later.')
      setMessageType('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="container-custom">
        <div className="py-12 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8">
            {/* Brand and Description */}
            <div className="lg:col-span-2">
              <Link to="/" className="flex items-center space-x-2 mb-4">
                <div className="relative">
                  <Zap className="h-8 w-8 text-primary-600" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-success-500 rounded-full"></div>
                </div>
                <span className="text-xl font-bold text-gray-900">
                  Nix<span className="text-primary-600">bit</span>
                </span>
              </Link>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                Nixbit eliminates flaky tests with AI-powered detection. Save 5+ hours weekly, 
                boost CI/CD reliability, and ship with confidence.
              </p>
              <div className="flex space-x-4">
                {socialLinks.map((social) => (
                  <a
                    key={social.name}
                    href={social.href}
                    className="text-gray-400 hover:text-primary-600 transition-colors duration-200"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="sr-only">{social.name}</span>
                    <social.icon className="h-5 w-5" />
                  </a>
                ))}
              </div>
            </div>

            {/* Product Links */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">
                Product
              </h3>
              <ul className="space-y-3">
                {footerLinks.product.map((link) => (
                  <li key={link.name}>
                    <Link
                      to={link.href}
                      className="text-sm text-gray-600 hover:text-primary-600 transition-colors duration-200"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">
                Company
              </h3>
              <ul className="space-y-3">
                {footerLinks.company.map((link) => (
                  <li key={link.name}>
                    <Link
                      to={link.href}
                      className="text-sm text-gray-600 hover:text-primary-600 transition-colors duration-200"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources Links */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">
                Resources
              </h3>
              <ul className="space-y-3">
                {footerLinks.resources.map((link) => (
                  <li key={link.name}>
                    <Link
                      to={link.href}
                      className="text-sm text-gray-600 hover:text-primary-600 transition-colors duration-200"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Newsletter Signup */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">
                Stay Updated
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Get the latest updates on new features and beta releases.
              </p>
              <form onSubmit={handleEmailSubmit} className="flex flex-col space-y-2">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50"
                  required
                />
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="btn-primary text-sm py-2 disabled:opacity-50"
                >
                  {isSubmitting ? 'Subscribing...' : 'Subscribe'}
                </button>
                {message && (
                  <div className={`text-xs mt-2 ${
                    messageType === 'success' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {message}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-200 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-600">
              © {currentYear} Nixbit. All rights reserved.
            </p>
            <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6 mt-4 md:mt-0">
              <div className="flex items-center space-x-4">
                <Link to="/privacy" className="text-sm text-gray-500 hover:text-primary-600 transition-colors">
                  Privacy
                </Link>
                <Link to="/terms" className="text-sm text-gray-500 hover:text-primary-600 transition-colors">
                  Terms
                </Link>
                <Link to="/contact" className="text-sm text-gray-500 hover:text-primary-600 transition-colors">
                  Support
                </Link>
              </div>
              <span className="text-sm text-gray-600">Made with ❤️ for developers</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer