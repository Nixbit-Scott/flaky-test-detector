import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Target, 
  Lightbulb, 
  Users, 
  Zap,
  Shield,
  Brain,
  TrendingUp,
  Clock,
  Heart,
  Code,
  Rocket
} from 'lucide-react'

const AboutPage: React.FC = () => {
  const stats = [
    { value: '94%', label: 'Flaky Test Detection Accuracy', icon: Target },
    { value: '5hrs', label: 'Weekly Time Saved per Developer', icon: Clock },
    { value: '67%', label: 'Reduction in Pipeline Failures', icon: TrendingUp },
    { value: '3min', label: 'Average Integration Setup Time', icon: Zap }
  ]

  const values = [
    {
      icon: Brain,
      title: 'AI-First Approach',
      description: 'We believe artificial intelligence should solve problems that waste human time, starting with flaky test detection and intelligent retry logic.'
    },
    {
      icon: Shield,
      title: 'Reliability Obsession',
      description: 'Every feature we build focuses on making software development more reliable, predictable, and frustration-free for development teams.'
    },
    {
      icon: Users,
      title: 'Developer Experience',
      description: 'We design for developers by developers, creating tools that integrate seamlessly into existing workflows without disruption.'
    },
    {
      icon: Rocket,
      title: 'Continuous Innovation',
      description: 'We constantly evolve our AI models and platform capabilities based on real-world usage patterns and customer feedback.'
    }
  ]

  const timeline = [
    {
      year: '2024',
      title: 'The Problem Recognition',
      description: 'After experiencing countless hours lost to flaky tests across multiple development teams, we realized the industry needed an intelligent solution.'
    },
    {
      year: '2024',
      title: 'AI Model Development',
      description: 'Built and trained our first machine learning models specifically for flaky test pattern recognition with 94% accuracy rates.'
    },
    {
      year: '2025',
      title: 'Platform Launch',
      description: 'Launched Nixbit with core integrations for Slack, Teams, and webhook systems, processing thousands of test results daily.'
    },
    {
      year: '2025',
      title: 'Integration Expansion',
      description: 'Roadmap includes 25+ integrations across CI/CD platforms, testing frameworks, and monitoring tools for comprehensive DevOps coverage.'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-white border-b border-gray-200">
        <div className="container-custom section-padding">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto text-center"
          >
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Making Software Development More Reliable
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Nixbit is the AI-powered intelligence layer that transforms flaky, unreliable tests 
              into predictable, trustworthy development workflows. We enhance your existing tools 
              rather than replace them.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/signup" className="btn-primary">
                Start Free Trial
              </Link>
              <Link to="/integrations" className="btn-outline">
                View Integrations
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="text-center"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-lg mb-4">
                    <Icon className="h-6 w-6 text-primary-600" />
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</div>
                  <div className="text-gray-600 text-sm">{stat.label}</div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-6">
                <Lightbulb className="h-8 w-8 text-primary-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Mission</h2>
              <p className="text-lg text-gray-600 mb-8">
                Every developer has experienced the frustration of flaky tests - tests that pass 
                sometimes and fail other times for no clear reason. These unreliable tests waste 
                countless hours, erode confidence in CI/CD pipelines, and slow down software delivery.
              </p>
              <p className="text-lg text-gray-600">
                <strong>We believe there's a better way.</strong> By applying artificial intelligence 
                specifically trained on test failure patterns, we can automatically detect flaky tests, 
                implement intelligent retry logic, and provide actionable insights that make development 
                workflows more reliable and developer-friendly.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">The Problem We Solve</h3>
                <ul className="space-y-3 text-gray-600">
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-2 h-2 bg-red-500 rounded-full mt-2 mr-3"></span>
                    Development teams waste 2-5 hours per week debugging flaky test failures
                  </li>
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-2 h-2 bg-red-500 rounded-full mt-2 mr-3"></span>
                    Unreliable tests reduce confidence in CI/CD pipelines and slow deployments
                  </li>
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-2 h-2 bg-red-500 rounded-full mt-2 mr-3"></span>
                    Manual test failure investigation is time-consuming and error-prone
                  </li>
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-2 h-2 bg-red-500 rounded-full mt-2 mr-3"></span>
                    Basic retry logic doesn't distinguish between real failures and flakiness
                  </li>
                </ul>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">Our Solution</h3>
                <ul className="space-y-3 text-gray-600">
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></span>
                    AI-powered detection with 94% accuracy identifies flaky tests automatically
                  </li>
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></span>
                    Intelligent retry logic only retries tests likely to pass on retry
                  </li>
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></span>
                    Comprehensive analytics and insights for long-term test health improvement
                  </li>
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></span>
                    Seamless integration with existing CI/CD tools and workflows
                  </li>
                </ul>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Values</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              The principles that guide how we build products and serve our customers
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => {
              const Icon = value.icon
              return (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="text-center"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-lg mb-4">
                    <Icon className="h-6 w-6 text-primary-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{value.title}</h3>
                  <p className="text-gray-600 text-sm">{value.description}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Journey</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From recognizing the problem to building the solution
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              
              {timeline.map((item, index) => (
                <motion.div
                  key={item.year}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.2 }}
                  className="relative flex items-start mb-12"
                >
                  {/* Timeline dot */}
                  <div className="absolute left-6 w-4 h-4 bg-primary-600 rounded-full border-4 border-white shadow-lg"></div>
                  
                  {/* Content */}
                  <div className="ml-16">
                    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                      <div className="flex items-center mb-2">
                        <span className="bg-primary-100 text-primary-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                          {item.year}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                      <p className="text-gray-600">{item.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-6">
              <Code className="h-8 w-8 text-primary-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Built by Developers, for Developers</h2>
            <p className="text-lg text-gray-600 mb-8">
              Our team understands the pain of flaky tests because we've lived it. We're building 
              the solution we wished existed when we were debugging test failures at 2 AM before 
              important releases.
            </p>
            
            <div className="grid md:grid-cols-3 gap-8 mb-12">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600 mb-2">Remote-First</div>
                <p className="text-gray-600">
                  Distributed team focused on asynchronous collaboration and global talent
                </p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600 mb-2">Open Source Friendly</div>
                <p className="text-gray-600">
                  We contribute back to the developer community and support open source projects
                </p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600 mb-2">Customer-Driven</div>
                <p className="text-gray-600">
                  Every feature and integration is prioritized based on real customer needs
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-8">
              <div className="flex items-center justify-center mb-4">
                <Heart className="h-6 w-6 text-red-500 mr-2" />
                <span className="text-lg font-semibold text-gray-900">We're hiring!</span>
              </div>
              <p className="text-gray-600 mb-6">
                Join our mission to make software development more reliable. We're looking for 
                passionate engineers, AI researchers, and developer advocates.
              </p>
              <Link 
                to="/contact" 
                className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium"
              >
                View open positions
                <span className="ml-1">→</span>
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
              Ready to End Flaky Test Frustration?
            </h2>
            <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
              Join development teams who've reduced pipeline failures by 67% and saved 5+ hours 
              per developer per week with intelligent test reliability.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link 
                to="/signup" 
                className="bg-white text-primary-600 hover:bg-gray-50 px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                Start Free Trial
              </Link>
              <Link 
                to="/contact" 
                className="border border-primary-300 text-white hover:bg-primary-700 px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                Schedule Demo
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default AboutPage