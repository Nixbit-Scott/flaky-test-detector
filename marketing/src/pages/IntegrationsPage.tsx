import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  GitBranch, 
  Settings, 
  Webhook, 
  Shield, 
  CheckCircle, 
  ExternalLink, 
  ArrowRight,
  Clock,
  Bell,
  Code,
  Database,
  Monitor
} from 'lucide-react'

const IntegrationsPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'cicd' | 'notifications' | 'testing' | 'monitoring'>('cicd')

  const integrationCategories = [
    {
      id: 'cicd' as const,
      name: 'CI/CD Platforms',
      icon: GitBranch,
      description: 'Connect your continuous integration and deployment pipelines'
    },
    {
      id: 'notifications' as const,
      name: 'Notifications',
      icon: Bell,
      description: 'Get real-time alerts about flaky tests and system status'
    },
    {
      id: 'testing' as const,
      name: 'Testing Frameworks',
      icon: Code,
      description: 'Seamlessly integrate with your existing testing tools'
    },
    {
      id: 'monitoring' as const,
      name: 'Monitoring & APM',
      icon: Monitor,
      description: 'Connect with your observability and monitoring stack'
    }
  ]

  const cicdIntegrations = [
    {
      name: 'GitHub Actions',
      description: 'Native integration with GitHub workflows for automated flaky test detection',
      icon: '🐙',
      status: 'available',
      tier: 'all',
      features: [
        'Automatic webhook configuration',
        'PR status checks',
        'Test result analysis',
        'Flaky test comments on PRs',
        'Intelligent retry workflows'
      ],
      setupTime: '2 minutes',
      docs: '/docs/integrations/github-actions'
    },
    {
      name: 'GitLab CI',
      description: 'Deep integration with GitLab pipelines and merge request workflows',
      icon: '🦊',
      status: 'available',
      tier: 'all',
      features: [
        'Pipeline integration',
        'Merge request notes',
        'Custom retry policies',
        'Parallel job analysis',
        'GitLab API integration'
      ],
      setupTime: '3 minutes',
      docs: '/docs/integrations/gitlab-ci'
    },
    {
      name: 'Jenkins',
      description: 'Comprehensive Jenkins plugin for flaky test detection and management',
      icon: '🔧',
      status: 'available',
      tier: 'all',
      features: [
        'Jenkins plugin installation',
        'Build step integration',
        'Test report parsing',
        'Pipeline orchestration',
        'Custom notification rules'
      ],
      setupTime: '5 minutes',
      docs: '/docs/integrations/jenkins'
    },
    {
      name: 'CircleCI',
      description: 'Streamlined integration with CircleCI orbs and workflows',
      icon: '⭕',
      status: 'available',
      tier: 'team',
      features: [
        'CircleCI orb available',
        'Workflow integration',
        'Test splitting optimization',
        'Parallel execution analysis',
        'Context-aware retry logic'
      ],
      setupTime: '3 minutes',
      docs: '/docs/integrations/circleci'
    },
    {
      name: 'Azure DevOps',
      description: 'Native Azure Pipelines extension for enterprise teams',
      icon: '🔷',
      status: 'available',
      tier: 'enterprise',
      features: [
        'Azure DevOps extension',
        'Pipeline templates',
        'Work item integration',
        'Release gate integration',
        'Azure Boards sync'
      ],
      setupTime: '4 minutes',
      docs: '/docs/integrations/azure-devops'
    },
    {
      name: 'TeamCity',
      description: 'JetBrains TeamCity plugin for intelligent test management',
      icon: '🏗️',
      status: 'coming-soon',
      tier: 'enterprise',
      features: [
        'TeamCity plugin',
        'Build configuration analysis',
        'Test history tracking',
        'Custom build steps',
        'Integration with IntelliJ IDEA'
      ],
      setupTime: '5 minutes',
      docs: '/docs/integrations/teamcity'
    }
  ]

  const notificationIntegrations = [
    {
      name: 'Slack',
      description: 'Real-time notifications and interactive commands in your Slack workspace',
      icon: '💬',
      status: 'available',
      tier: 'all',
      features: [
        'Instant flaky test alerts',
        'Daily/weekly summaries',
        'Interactive slash commands',
        'Custom channel routing',
        'Threaded conversations'
      ],
      setupTime: '1 minute',
      docs: '/docs/integrations/slack'
    },
    {
      name: 'Microsoft Teams',
      description: 'Seamless integration with Teams channels and workflows',
      icon: '👥',
      status: 'available',
      tier: 'all',
      features: [
        'Teams channel notifications',
        'Adaptive card messages',
        'Bot commands',
        'Meeting integration',
        'Custom notification rules'
      ],
      setupTime: '2 minutes',
      docs: '/docs/integrations/teams'
    },
    {
      name: 'Discord',
      description: 'Developer-friendly notifications for Discord communities',
      icon: '🎮',
      status: 'available',
      tier: 'team',
      features: [
        'Discord webhook support',
        'Rich embed messages',
        'Role-based notifications',
        'Channel categorization',
        'Custom emoji reactions'
      ],
      setupTime: '1 minute',
      docs: '/docs/integrations/discord'
    },
    {
      name: 'Email',
      description: 'Traditional email notifications with smart filtering and digest options',
      icon: '📧',
      status: 'available',
      tier: 'all',
      features: [
        'Individual alerts',
        'Daily/weekly digests',
        'Smart filtering',
        'HTML formatting',
        'Unsubscribe management'
      ],
      setupTime: 'Instant',
      docs: '/docs/integrations/email'
    },
    {
      name: 'PagerDuty',
      description: 'Critical incident management for high-severity flaky test patterns',
      icon: '🚨',
      status: 'available',
      tier: 'enterprise',
      features: [
        'Incident escalation',
        'On-call scheduling',
        'Severity-based routing',
        'Incident analytics',
        'Custom escalation policies'
      ],
      setupTime: '3 minutes',
      docs: '/docs/integrations/pagerduty'
    },
    {
      name: 'Webhooks',
      description: 'Custom webhook endpoints for building your own integrations',
      icon: '🔗',
      status: 'available',
      tier: 'all',
      features: [
        'Custom HTTP endpoints',
        'JSON payload format',
        'Retry logic',
        'Authentication headers',
        'Event filtering'
      ],
      setupTime: '5 minutes',
      docs: '/docs/integrations/webhooks'
    }
  ]

  const testingIntegrations = [
    {
      name: 'Jest',
      description: 'Native support for Jest test results and reporting',
      icon: '🃏',
      status: 'available',
      tier: 'all',
      features: [
        'Jest reporter plugin',
        'Snapshot test analysis',
        'Coverage correlation',
        'Test timing analysis',
        'Custom matchers'
      ],
      setupTime: '2 minutes',
      docs: '/docs/integrations/jest'
    },
    {
      name: 'Cypress',
      description: 'End-to-end test reliability tracking for Cypress tests',
      icon: '🌲',
      status: 'available',
      tier: 'all',
      features: [
        'Cypress plugin',
        'Video/screenshot analysis',
        'Browser-specific patterns',
        'Network failure detection',
        'Visual regression tracking'
      ],
      setupTime: '3 minutes',
      docs: '/docs/integrations/cypress'
    },
    {
      name: 'Playwright',
      description: 'Cross-browser testing reliability with Playwright integration',
      icon: '🎭',
      status: 'available',
      tier: 'team',
      features: [
        'Multi-browser analysis',
        'Playwright reporter',
        'Trace file integration',
        'Device-specific patterns',
        'Accessibility test tracking'
      ],
      setupTime: '3 minutes',
      docs: '/docs/integrations/playwright'
    },
    {
      name: 'Selenium',
      description: 'WebDriver test stability analysis and reporting',
      icon: '🕷️',
      status: 'available',
      tier: 'team',
      features: [
        'Grid integration',
        'Driver failure analysis',
        'Browser compatibility tracking',
        'Element stability patterns',
        'Custom wait strategies'
      ],
      setupTime: '4 minutes',
      docs: '/docs/integrations/selenium'
    },
    {
      name: 'PyTest',
      description: 'Python testing framework integration with advanced analytics',
      icon: '🐍',
      status: 'available',
      tier: 'all',
      features: [
        'PyTest plugin',
        'Fixture analysis',
        'Parametrized test tracking',
        'Marks and metadata',
        'Custom reporting hooks'
      ],
      setupTime: '2 minutes',
      docs: '/docs/integrations/pytest'
    },
    {
      name: 'TestNG',
      description: 'Java testing framework with enterprise-grade reliability tracking',
      icon: '☕',
      status: 'coming-soon',
      tier: 'enterprise',
      features: [
        'TestNG listener',
        'Suite-level analysis',
        'Dependency tracking',
        'Parallel execution patterns',
        'Custom annotations'
      ],
      setupTime: '3 minutes',
      docs: '/docs/integrations/testng'
    }
  ]

  const monitoringIntegrations = [
    {
      name: 'Datadog',
      description: 'Correlate flaky tests with infrastructure metrics and APM data',
      icon: '🐕',
      status: 'available',
      tier: 'enterprise',
      features: [
        'Custom metrics export',
        'Dashboard widgets',
        'Alert correlation',
        'Log integration',
        'APM trace analysis'
      ],
      setupTime: '5 minutes',
      docs: '/docs/integrations/datadog'
    },
    {
      name: 'New Relic',
      description: 'Application performance monitoring integration for test reliability',
      icon: '📊',
      status: 'available',
      tier: 'enterprise',
      features: [
        'Custom events',
        'Query builder integration',
        'Alerting policies',
        'Error tracking correlation',
        'Performance baselines'
      ],
      setupTime: '4 minutes',
      docs: '/docs/integrations/newrelic'
    },
    {
      name: 'Prometheus',
      description: 'Export test reliability metrics to your Prometheus monitoring stack',
      icon: '🔥',
      status: 'available',
      tier: 'team',
      features: [
        'Metrics endpoint',
        'Custom labels',
        'Grafana dashboards',
        'Alert manager rules',
        'Time series analysis'
      ],
      setupTime: '6 minutes',
      docs: '/docs/integrations/prometheus'
    },
    {
      name: 'Grafana',
      description: 'Beautiful dashboards and visualizations for test reliability data',
      icon: '📈',
      status: 'available',
      tier: 'team',
      features: [
        'Pre-built dashboards',
        'Custom panels',
        'Alerting rules',
        'Data source plugins',
        'Annotation support'
      ],
      setupTime: '4 minutes',
      docs: '/docs/integrations/grafana'
    },
    {
      name: 'Splunk',
      description: 'Enterprise log analysis and correlation with test patterns',
      icon: '🔍',
      status: 'coming-soon',
      tier: 'enterprise',
      features: [
        'Log forwarding',
        'Custom searches',
        'Dashboard creation',
        'Alert automation',
        'Machine learning insights'
      ],
      setupTime: '7 minutes',
      docs: '/docs/integrations/splunk'
    }
  ]

  const getCurrentIntegrations = () => {
    switch (activeCategory) {
      case 'cicd': return cicdIntegrations
      case 'notifications': return notificationIntegrations
      case 'testing': return testingIntegrations
      case 'monitoring': return monitoringIntegrations
      default: return cicdIntegrations
    }
  }

  const getTierBadge = (tier: string) => {
    const tierColors = {
      'all': 'bg-green-100 text-green-800',
      'team': 'bg-blue-100 text-blue-800',
      'enterprise': 'bg-purple-100 text-purple-800'
    }
    return tierColors[tier as keyof typeof tierColors] || tierColors.all
  }

  const getStatusBadge = (status: string) => {
    if (status === 'available') {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" />
        Available
      </span>
    } else if (status === 'coming-soon') {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <Clock className="w-3 h-3 mr-1" />
        Coming Soon
      </span>
    }
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-white border-b border-gray-200">
        <div className="container-custom section-padding">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-6">
              <Webhook className="h-8 w-8 text-primary-600" />
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Integrations
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Connect Nixbit with your existing tools and workflows. Set up in minutes, 
              not hours, with our comprehensive integration ecosystem.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/signup" className="btn-primary">
                Get Started Free
              </Link>
              <Link to="/docs" className="btn-outline">
                View Documentation
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600 mb-2">25+</div>
              <div className="text-gray-600">Integrations</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600 mb-2">&lt;5min</div>
              <div className="text-gray-600">Average Setup</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600 mb-2">99.9%</div>
              <div className="text-gray-600">Uptime SLA</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600 mb-2">24/7</div>
              <div className="text-gray-600">Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Category Navigation */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Choose Your Integration Category
            </h2>
            <p className="text-lg text-gray-600">
              Explore integrations by category to find the perfect fit for your workflow
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {integrationCategories.map((category) => {
              const Icon = category.icon
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`p-6 rounded-xl border-2 text-left transition-all ${
                    activeCategory === category.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <Icon className={`h-8 w-8 mb-4 ${
                    activeCategory === category.id ? 'text-primary-600' : 'text-gray-600'
                  }`} />
                  <h3 className={`text-lg font-semibold mb-2 ${
                    activeCategory === category.id ? 'text-primary-900' : 'text-gray-900'
                  }`}>
                    {category.name}
                  </h3>
                  <p className={`text-sm ${
                    activeCategory === category.id ? 'text-primary-700' : 'text-gray-600'
                  }`}>
                    {category.description}
                  </p>
                </button>
              )
            })}
          </div>

          {/* Integration Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {getCurrentIntegrations().map((integration, index) => (
              <motion.div
                key={integration.name}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="card card-hover h-full"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <span className="text-3xl mr-3">{integration.icon}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {integration.name}
                      </h3>
                      <div className="flex items-center space-x-2 mt-1">
                        {getStatusBadge(integration.status)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTierBadge(integration.tier)}`}>
                          {integration.tier === 'all' ? 'All Plans' : integration.tier.charAt(0).toUpperCase() + integration.tier.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-gray-600 mb-4">
                  {integration.description}
                </p>

                <div className="space-y-3 mb-6 flex-1">
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="h-4 w-4 mr-2 text-primary-600" />
                    Setup time: {integration.setupTime}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-900">Key Features:</div>
                    <ul className="space-y-1">
                      {integration.features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="flex items-center text-sm text-gray-600">
                          <CheckCircle className="h-3 w-3 mr-2 text-green-500 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                      {integration.features.length > 3 && (
                        <li className="text-sm text-gray-500">
                          +{integration.features.length - 3} more features
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                <div className="flex flex-col space-y-3">
                  {integration.status === 'available' ? (
                    <>
                      <Link 
                        to="/signup" 
                        className="btn-primary text-center"
                      >
                        Set Up Integration
                      </Link>
                      <a 
                        href={integration.docs}
                        className="inline-flex items-center justify-center text-primary-600 hover:text-primary-700 font-medium text-sm"
                      >
                        View Documentation
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </>
                  ) : (
                    <>
                      <button 
                        disabled
                        className="btn-primary opacity-50 cursor-not-allowed text-center"
                      >
                        Coming Soon
                      </button>
                      <Link 
                        to="/contact"
                        className="inline-flex items-center justify-center text-primary-600 hover:text-primary-700 font-medium text-sm"
                      >
                        Request Beta Access
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise Section */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-6">
              <Shield className="h-8 w-8 text-purple-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Enterprise Integrations
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Need a custom integration or enterprise-specific features? Our team can build 
              tailored solutions for your unique requirements.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
                  <Code className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Custom APIs</h3>
                <p className="text-gray-600 text-sm">
                  Bespoke API integrations built to your specifications
                </p>
              </div>
              
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mb-4">
                  <Database className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Connectors</h3>
                <p className="text-gray-600 text-sm">
                  Direct database and data warehouse integrations
                </p>
              </div>
              
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-100 rounded-lg mb-4">
                  <Settings className="h-6 w-6 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">SSO & Security</h3>
                <p className="text-gray-600 text-sm">
                  Enterprise SSO, RBAC, and security compliance
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/contact" className="btn-primary">
                Schedule Consultation
              </Link>
              <Link to="/contact" className="btn-outline">
                Enterprise Plans
              </Link>
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
              Ready to Connect Your Tools?
            </h2>
            <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
              Start integrating Nixbit with your existing workflow in minutes. 
              Most integrations require zero code changes.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link 
                to="/signup" 
                className="bg-white text-primary-600 hover:bg-gray-50 px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                Start Free Trial
              </Link>
              <Link 
                to="/docs" 
                className="border border-primary-300 text-white hover:bg-primary-700 px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                Browse Documentation
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default IntegrationsPage