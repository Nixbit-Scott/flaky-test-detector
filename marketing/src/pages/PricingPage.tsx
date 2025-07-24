import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, Zap, Star, Crown } from 'lucide-react'

const PricingPage: React.FC = () => {
  const plans = [
    {
      name: 'Starter',
      price: 29,
      description: 'Perfect for small teams getting started',
      icon: Zap,
      features: [
        'Up to 5 developers',
        'Basic flaky test detection',
        'Email notifications',
        'Community support',
        '1 repository integration',
      ],
      cta: 'Start Free Beta',
      popular: false,
    },
    {
      name: 'Team',
      price: 99,
      description: 'Best for growing development teams',
      icon: Star,
      features: [
        'Up to 25 developers',
        'Advanced AI detection',
        'Slack/Teams integration',
        'Priority support',
        'Unlimited repositories',
        'Custom retry policies',
        'Analytics dashboard',
      ],
      cta: 'Start Free Beta',
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 299,
      description: 'For large organizations with custom needs',
      icon: Crown,
      features: [
        'Unlimited developers',
        'Advanced predictive analytics',
        'Custom integrations',
        'Dedicated support',
        'On-premise deployment',
        'SSO/SAML integration',
        'SLA guarantees',
        'Custom training',
      ],
      cta: 'Contact Sales',
      popular: false,
    },
  ]

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero Section */}
      <section className="bg-white section-padding">
        <div className="container-custom text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Choose the perfect plan for your team. All plans include Nixbit's core AI-powered 
              flaky test detection. Upgrade or downgrade anytime.
            </p>
            <div className="inline-flex items-center space-x-2 bg-success-100 text-success-800 px-4 py-2 rounded-full text-sm font-medium">
              <CheckCircle className="h-4 w-4" />
              <span>Free beta access - No credit card required</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`card card-hover relative ${
                  plan.popular 
                    ? 'ring-2 ring-primary-500 bg-white' 
                    : 'bg-white'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-primary-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </div>
                  </div>
                )}

                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
                    <plan.icon className="h-8 w-8 text-primary-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {plan.description}
                  </p>
                  <div className="mb-4">
                    <span className="text-5xl font-bold text-gray-900">
                      ${plan.price}
                    </span>
                    <span className="text-gray-600 ml-1">/month</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-success-500 mr-3 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to={plan.cta === 'Contact Sales' ? '/contact' : '/signup'}
                  className={`block w-full text-center py-3 px-6 rounded-lg font-semibold transition-all duration-200 ${
                    plan.popular
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-white section-padding">
        <div className="container-custom">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-gray-600">
              Got questions? We've got answers.
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="space-y-6">
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  What's included in the beta?
                </h3>
                <p className="text-gray-600">
                  Beta access includes all core features of your selected plan. We're actively 
                  gathering feedback to improve the product before general availability.
                </p>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Can I change plans later?
                </h3>
                <p className="text-gray-600">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect 
                  immediately, and billing is prorated.
                </p>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  How does the setup process work?
                </h3>
                <p className="text-gray-600">
                  Setup takes about 5 minutes. You'll add our webhook to your CI/CD system, 
                  and we'll start analyzing your test results immediately.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default PricingPage