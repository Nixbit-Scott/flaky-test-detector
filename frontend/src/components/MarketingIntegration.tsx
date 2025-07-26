import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle, Users, Zap, TrendingUp, Star } from 'lucide-react';

interface MarketingIntegrationProps {
  onContinueToApp: () => void;
  userEmail?: string;
  source?: string;
}

const MarketingIntegration: React.FC<MarketingIntegrationProps> = ({ 
  onContinueToApp, 
  userEmail, 
  source 
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showContinue, setShowContinue] = useState(false);

  const welcomeSlides = [
    {
      icon: CheckCircle,
      title: "Welcome to the Beta!",
      description: "You've successfully joined 500+ developers already using Nixbit to eliminate flaky tests.",
      stats: "Save 2-5 hours per week on debugging",
      color: "text-green-600"
    },
    {
      icon: TrendingUp,
      title: "Real Impact, Real Results",
      description: "Teams using Nixbit report 85% reduction in CI/CD pipeline failures and 3x faster debugging.",
      stats: "85% fewer pipeline failures",
      color: "text-blue-600"
    },
    {
      icon: Zap,
      title: "AI-Powered Intelligence",
      description: "Our AI analyzes your test patterns and provides actionable insights to fix flaky tests faster.",
      stats: "Get root cause analysis in seconds",
      color: "text-purple-600"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => {
        if (prev < welcomeSlides.length - 1) {
          return prev + 1;
        } else {
          setShowContinue(true);
          return prev;
        }
      });
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  const currentSlideData = welcomeSlides[currentSlide];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        
        {/* Left Side - Welcome Content */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="text-white"
        >
          <div className="mb-8">
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">
              Welcome to
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent block">
                Nixbit
              </span>
            </h1>
            <p className="text-xl text-gray-200 mb-6">
              Join the beta and start eliminating flaky tests today
            </p>
            
            {userEmail && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-200">
                  <strong>Signed up as:</strong> {userEmail}
                </p>
                {source && (
                  <p className="text-xs text-gray-300 mt-1">
                    <strong>Source:</strong> {source}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Social Proof */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="flex -space-x-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full border-2 border-white flex items-center justify-center">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                ))}
              </div>
              <span className="text-gray-200 text-sm">500+ developers already joined</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                ))}
              </div>
              <span className="text-gray-200 text-sm">Rated 4.9/5 by beta users</span>
            </div>
          </div>
        </motion.div>

        {/* Right Side - Animated Welcome Slides */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="bg-white rounded-2xl shadow-2xl p-8"
        >
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-6 ${currentSlideData.color} bg-opacity-10`}>
              <currentSlideData.icon className={`w-8 h-8 ${currentSlideData.color}`} />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {currentSlideData.title}
            </h2>
            
            <p className="text-gray-600 mb-6 leading-relaxed">
              {currentSlideData.description}
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm font-semibold text-gray-900">
                {currentSlideData.stats}
              </p>
            </div>
          </motion.div>

          {/* Progress Dots */}
          <div className="flex justify-center space-x-2 mb-6">
            {welcomeSlides.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentSlide ? 'bg-indigo-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          {/* Continue Button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: showContinue ? 1 : 0 }}
            transition={{ duration: 0.5 }}
          >
            {showContinue && (
              <button
                onClick={onContinueToApp}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-all duration-200 transform hover:scale-105"
              >
                <span>Continue to Dashboard</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </motion.div>

          {!showContinue && (
            <div className="text-center">
              <button
                onClick={() => {
                  setCurrentSlide(welcomeSlides.length - 1);
                  setShowContinue(true);
                }}
                className="text-gray-500 hover:text-gray-700 text-sm font-medium"
              >
                Skip intro
              </button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full opacity-20 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full opacity-20 blur-3xl"></div>
      </div>
    </div>
  );
};

export default MarketingIntegration;