import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Brain, 
  Shield, 
  Zap, 
  BarChart3, 
  GitBranch, 
  Clock, 
  CheckCircle, 
  X, 
  Minus,
  Star,
  Crown,
  AlertTriangle,
  Repeat,
  Database,
  Bell,
  Users,
  Settings,
  Lock
} from 'lucide-react'

interface Feature {
  icon: React.ElementType
  title: string
  description: string
  starter: boolean | 'limited'
  team: boolean | 'limited'
  enterprise: boolean | 'limited'
  category: 'detection' | 'automation' | 'analytics' | 'integration' | 'support'
}

const FeaturesPage: React.FC = () => {
  const features: Feature[] = [
    // Detection Features
    {
      icon: Brain,
      title: 'AI-Powered Flaky Test Detection',
      description: 'Advanced machine learning algorithms identify flaky tests with 94% accuracy by analyzing test patterns and execution history.',
      starter: 'limited',
      team: true,
      enterprise: true,
      category: 'detection'
    },
    {
      icon: AlertTriangle,
      title: 'Pattern Recognition',
      description: 'Detects complex failure patterns including environment-specific failures, timing issues, and resource conflicts.',
      starter: false,
      team: true,
      enterprise: true,
      category: 'detection'
    },
    {
      icon: BarChart3,
      title: 'Statistical Analysis',
      description: 'Comprehensive statistical analysis of test results with confidence scores and failure probability predictions.',
      starter: false,
      team: 'limited',
      enterprise: true,
      category: 'detection'
    },

    // Automation Features
    {
      icon: Repeat,
      title: 'Intelligent Retry Logic',
      description: 'Smart retry strategies that adapt to different test types and failure patterns, reducing false negatives.',
      starter: 'limited',
      team: true,
      enterprise: true,
      category: 'automation'
    },
    {
      icon: Shield,
      title: 'Automatic Test Quarantine',
      description: 'Automatically quarantine problematic tests to prevent pipeline failures while maintaining development velocity.',
      starter: false,
      team: true,
      enterprise: true,
      category: 'automation'
    },
    {
      icon: Settings,
      title: 'Custom Retry Policies',
      description: 'Configure custom retry policies per project, test suite, or individual test with advanced backoff strategies.',
      starter: false,
      team: true,
      enterprise: true,
      category: 'automation'
    },

    // Analytics Features
    {
      icon: BarChart3,
      title: 'Real-time Analytics Dashboard',
      description: 'Live dashboard showing test stability metrics, failure trends, and team productivity insights.',
      starter: 'limited',
      team: true,
      enterprise: true,
      category: 'analytics'
    },
    {
      icon: Clock,
      title: 'Time Savings Calculator',
      description: 'Track and quantify time saved by eliminating flaky test debugging and false failures.',
      starter: true,
      team: true,
      enterprise: true,
      category: 'analytics'
    },
    {
      icon: Database,
      title: 'Historical Trend Analysis',
      description: 'Long-term trend analysis with data retention up to 3 years for enterprise customers.',
      starter: false,
      team: 'limited',
      enterprise: true,
      category: 'analytics'
    },

    // Integration Features
    {
      icon: GitBranch,
      title: 'CI/CD Platform Integration',
      description: 'Native integrations with GitHub Actions, GitLab CI, Jenkins, and other popular CI/CD platforms.',
      starter: 'limited',
      team: true,
      enterprise: true,
      category: 'integration'
    },
    {
      icon: Bell,
      title: 'Slack/Teams Notifications',
      description: 'Real-time notifications in Slack, Microsoft Teams, and email when flaky tests are detected or quarantined.',
      starter: false,
      team: true,
      enterprise: true,
      category: 'integration'
    },
    {
      icon: Lock,
      title: 'SSO/SAML Integration',
      description: 'Enterprise-grade single sign-on with SAML, OAuth, and LDAP support for seamless team access.',
      starter: false,
      team: false,
      enterprise: true,
      category: 'integration'
    },

    // Support Features
    {
      icon: Users,
      title: 'Team Management',
      description: 'User roles, permissions, and team management with audit logs and access controls.',
      starter: 'limited',
      team: true,
      enterprise: true,
      category: 'support'
    },
    {
      icon: Zap,
      title: '5-Minute Setup',
      description: 'Quick setup with guided onboarding and automatic configuration detection for popular frameworks.',
      starter: true,
      team: true,
      enterprise: true,
      category: 'support'
    }
  ]

  const plans = [
    {
      name: 'Starter',
      price: 29,
      icon: Zap,
      description: 'Perfect for small teams',
      popular: false
    },
    {
      name: 'Team',
      price: 99,
      icon: Star,
      description: 'Best for growing teams',
      popular: true
    },
    {
      name: 'Enterprise',
      price: 299,
      icon: Crown,
      description: 'For large organizations',
      popular: false
    }
  ]

  const categories = [
    { id: 'detection', name: 'AI Detection', icon: Brain },
    { id: 'automation', name: 'Automation', icon: Repeat },
    { id: 'analytics', name: 'Analytics', icon: BarChart3 },
    { id: 'integration', name: 'Integrations', icon: GitBranch },
    { id: 'support', name: 'Support', icon: Users }
  ]

  const renderFeatureIcon = (feature: boolean | 'limited') => {
    if (feature === true) {
      return <CheckCircle className="h-5 w-5 text-success-500" />
    } else if (feature === 'limited') {
      return <Minus className="h-5 w-5 text-warning-500" />
    } else {
      return <X className="h-5 w-5 text-gray-300" />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-white section-padding">
        <div className="container-custom text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Everything You Need to Nix Flaky Tests
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Comprehensive AI-powered tools to detect, manage, and eliminate flaky tests 
              from your development workflow. Ship with confidence.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a href="/beta-signup.html" className="btn-primary">
                Start Free Beta
              </a>
              <Link to="/pricing" className="btn-outline">
                View Pricing
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature Categories */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Powerful Features Across Every Plan
            </h2>
            <p className="text-lg text-gray-600">
              From basic detection to enterprise-grade analytics and automation
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 mb-16">
            {categories.map((category, index) => {
              const Icon = category.icon
              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="text-center"
                >
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
                    <Icon className="h-8 w-8 text-primary-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{category.name}</h3>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Feature Comparison by Plan
            </h2>
            <p className="text-lg text-gray-600">
              Choose the plan that fits your team's needs
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
              {/* Table Header */}
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left py-4 px-6 font-semibold text-gray-900 min-w-[300px]">
                    Features
                  </th>
                  {plans.map((plan) => {
                    const Icon = plan.icon
                    return (
                      <th key={plan.name} className="text-center py-4 px-6 min-w-[140px]">
                        <div className="flex flex-col items-center">
                          <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full mb-2 ${
                            plan.popular ? 'bg-primary-100' : 'bg-gray-100'
                          }`}>
                            <Icon className={`h-5 w-5 ${
                              plan.popular ? 'text-primary-600' : 'text-gray-600'
                            }`} />
                          </div>
                          <div className="font-semibold text-gray-900">{plan.name}</div>
                          <div className="text-sm text-gray-600">${plan.price}/month</div>
                          {plan.popular && (
                            <div className="bg-primary-500 text-white px-2 py-1 rounded text-xs mt-1">
                              Popular
                            </div>
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody>
                {categories.map((category) => {
                  const categoryFeatures = features.filter(f => f.category === category.id)
                  return (
                    <React.Fragment key={category.id}>
                      {/* Category Header */}
                      <tr className="bg-gray-25">
                        <td colSpan={4} className="py-3 px-6">
                          <div className="flex items-center">
                            <category.icon className="h-5 w-5 text-primary-600 mr-2" />
                            <span className="font-medium text-gray-900">{category.name}</span>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Category Features */}
                      {categoryFeatures.map((feature, index) => (
                        <tr key={feature.title} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="py-4 px-6">
                            <div className="flex items-start">
                              <feature.icon className="h-5 w-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
                              <div>
                                <div className="font-medium text-gray-900 mb-1">{feature.title}</div>
                                <div className="text-sm text-gray-600">{feature.description}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            {renderFeatureIcon(feature.starter)}
                          </td>
                          <td className="py-4 px-6 text-center">
                            {renderFeatureIcon(feature.team)}
                          </td>
                          <td className="py-4 px-6 text-center">
                            {renderFeatureIcon(feature.enterprise)}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-success-500 mr-2" />
              <span className="text-gray-600">Included</span>
            </div>
            <div className="flex items-center">
              <Minus className="h-4 w-4 text-warning-500 mr-2" />
              <span className="text-gray-600">Limited</span>
            </div>
            <div className="flex items-center">
              <X className="h-4 w-4 text-gray-300 mr-2" />
              <span className="text-gray-600">Not included</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-primary-600">
        <div className="container-custom text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Eliminate Flaky Tests?
            </h2>
            <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
              Join 50+ teams already saving 5+ hours per week with AI-powered test reliability.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a 
                href="/beta-signup.html" 
                className="bg-white text-primary-600 hover:bg-gray-50 px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                Start Free Beta
              </a>
              <Link 
                to="/contact" 
                className="border border-primary-300 text-white hover:bg-primary-700 px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                Contact Sales
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default FeaturesPage