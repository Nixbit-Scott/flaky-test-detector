import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Calculator, TrendingUp, DollarSign, Clock } from 'lucide-react'

const ROICalculatorSection: React.FC = () => {
  const [developers, setDevelopers] = useState(10)
  const [hourlyRate, setHourlyRate] = useState(75)
  const [hoursWasted, setHoursWasted] = useState(3)

  const calculateSavings = () => {
    const weeklyWaste = developers * hoursWasted * hourlyRate
    const annualWaste = weeklyWaste * 52
    const annualSavings = annualWaste * 0.8 // 80% reduction in flaky test issues
    
    return {
      weekly: weeklyWaste,
      annual: annualWaste,
      savings: annualSavings,
    }
  }

  const results = calculateSavings()

  return (
    <section className="bg-primary-50 section-padding">
      <div className="container-custom">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center space-x-2 bg-primary-100 text-primary-800 px-4 py-2 rounded-full text-sm font-medium mb-6"
          >
            <Calculator className="h-4 w-4" />
            <span>ROI Calculator</span>
          </motion.div>
          
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4"
          >
            Calculate Your Potential Savings
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-gray-600 max-w-2xl mx-auto"
          >
            See how much time and money your team could save by eliminating flaky tests
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Calculator Inputs */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="card"
          >
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              Your Team Details
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Developers
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={developers}
                  onChange={(e) => setDevelopers(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-sm text-gray-600 mt-1">
                  <span>1</span>
                  <span className="font-semibold text-primary-600">{developers}</span>
                  <span>100</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Average Hourly Rate ($)
                </label>
                <input
                  type="range"
                  min="25"
                  max="200"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-sm text-gray-600 mt-1">
                  <span>$25</span>
                  <span className="font-semibold text-primary-600">${hourlyRate}</span>
                  <span>$200</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hours Wasted Weekly on Flaky Tests
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={hoursWasted}
                  onChange={(e) => setHoursWasted(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-sm text-gray-600 mt-1">
                  <span>0.5h</span>
                  <span className="font-semibold text-primary-600">{hoursWasted}h</span>
                  <span>10h</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Results */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            <div className="card bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <div className="flex items-center mb-4">
                <div className="bg-red-100 p-3 rounded-lg mr-4">
                  <DollarSign className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-red-900">Current Annual Waste</h4>
                  <p className="text-red-700">Money lost to flaky tests</p>
                </div>
              </div>
              <div className="text-3xl font-bold text-red-600">
                ${results.annual.toLocaleString()}
              </div>
            </div>

            <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <div className="flex items-center mb-4">
                <div className="bg-green-100 p-3 rounded-lg mr-4">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-green-900">Potential Annual Savings</h4>
                  <p className="text-green-700">With FlakyDetector (80% reduction)</p>
                </div>
              </div>
              <div className="text-3xl font-bold text-green-600">
                ${results.savings.toLocaleString()}
              </div>
            </div>

            <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <div className="flex items-center mb-4">
                <div className="bg-blue-100 p-3 rounded-lg mr-4">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-blue-900">Time Saved Weekly</h4>
                  <p className="text-blue-700">Hours back to productive work</p>
                </div>
              </div>
              <div className="text-3xl font-bold text-blue-600">
                {(developers * hoursWasted * 0.8).toFixed(1)} hours
              </div>
            </div>

            <div className="bg-primary-600 text-white p-6 rounded-xl">
              <div className="text-center">
                <div className="text-2xl font-bold mb-2">
                  ROI: {((results.savings / (developers * 1200)) * 100).toFixed(0)}%
                </div>
                <p className="text-primary-100">
                  Return on investment in first year
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default ROICalculatorSection