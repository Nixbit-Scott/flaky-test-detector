import React from 'react'
import { motion } from 'framer-motion'
import { Zap, Shield, BarChart3, RefreshCw, Brain, Clock } from 'lucide-react'

const FeaturesSection: React.FC = () => {
  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Detection',
      description: 'Advanced machine learning algorithms identify flaky tests with 94% accuracy, analyzing patterns across your entire test suite.',
    },
    {
      icon: Shield,
      title: 'Automatic Quarantine',
      description: 'Instantly quarantine problematic tests to prevent pipeline failures while maintaining development velocity.',
    },
    {
      icon: RefreshCw,
      title: 'Intelligent Retry Logic',
      description: 'Smart retry strategies that adapt to different test types and failure patterns, reducing false negatives.',
    },
    {
      icon: BarChart3,
      title: 'Real-time Analytics',
      description: 'Comprehensive dashboards showing test stability trends, team productivity metrics, and ROI calculations.',
    },
    {
      icon: Zap,
      title: 'CI/CD Integration',
      description: 'Seamless integration with GitHub Actions, Jenkins, GitLab CI, and other popular CI/CD platforms.',
    },
    {
      icon: Clock,
      title: '5-Minute Setup',
      description: 'Get started in minutes with our simple webhook configuration. No complex infrastructure changes required.',
    },
  ]

  return (
    <section className="bg-gray-50 section-padding">
      <div className="container-custom">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4"
          >
            Everything You Need to Nix Flaky Tests
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-gray-600 max-w-3xl mx-auto"
          >
            Nixbit provides all the tools you need to detect, manage, and eliminate flaky tests 
            from your development workflow. Nix the flaky, ship with confidence.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="card card-hover"
            >
              <div className="flex items-center mb-4">
                <div className="bg-primary-100 p-3 rounded-lg mr-4">
                  <feature.icon className="h-6 w-6 text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {feature.title}
                </h3>
              </div>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default FeaturesSection