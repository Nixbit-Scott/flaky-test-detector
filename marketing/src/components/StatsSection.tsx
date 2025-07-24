import React from 'react'
import { motion } from 'framer-motion'

const StatsSection: React.FC = () => {
  const stats = [
    { value: '50+', label: 'Teams Using Beta', subtext: 'and growing daily' },
    { value: '5.2h', label: 'Average Time Saved', subtext: 'per developer weekly' },
    { value: '94%', label: 'Flaky Test Detection', subtext: 'accuracy rate' },
    { value: '$50K+', label: 'Annual Savings', subtext: 'per development team' },
  ]

  return (
    <section className="bg-white py-16 border-b border-gray-100">
      <div className="container-custom">
        <div className="text-center mb-12">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-3xl font-bold text-gray-900 mb-4"
          >
            Trusted by Development Teams Worldwide
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-gray-600"
          >
            Join the beta and see why teams are saving hours weekly
          </motion.p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl lg:text-5xl font-bold text-primary-600 mb-2">
                {stat.value}
              </div>
              <div className="text-lg font-semibold text-gray-900 mb-1">
                {stat.label}
              </div>
              <div className="text-sm text-gray-600">
                {stat.subtext}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default StatsSection