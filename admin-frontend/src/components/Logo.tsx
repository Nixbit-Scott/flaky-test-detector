import React from 'react';
import { Zap } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
  variant?: 'light' | 'dark';
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  showPulse = true,
  variant = 'light',
  className = '' 
}) => {
  const sizeClasses = {
    sm: {
      icon: 'h-6 w-6',
      text: 'text-lg',
      dot: 'w-2 h-2 -top-0.5 -right-0.5'
    },
    md: {
      icon: 'h-8 w-8',
      text: 'text-xl',
      dot: 'w-3 h-3 -top-1 -right-1'
    },
    lg: {
      icon: 'h-10 w-10',
      text: 'text-2xl',
      dot: 'w-4 h-4 -top-1 -right-1'
    }
  };

  const { icon, text, dot } = sizeClasses[size];

  const colorClasses = {
    light: {
      text: 'text-gray-900',
      accent: 'text-blue-600',
      icon: 'text-blue-600'
    },
    dark: {
      text: 'text-white',
      accent: 'text-blue-400',
      icon: 'text-blue-400'
    }
  };

  const colors = colorClasses[variant];

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="relative">
        <Zap className={`${icon} ${colors.icon}`} />
        {showPulse && (
          <div className={`absolute ${dot} bg-green-500 rounded-full animate-pulse`}></div>
        )}
      </div>
      <span className={`${text} font-bold ${colors.text}`}>
        Nix<span className={colors.accent}>bit</span>
      </span>
    </div>
  );
};

export default Logo;