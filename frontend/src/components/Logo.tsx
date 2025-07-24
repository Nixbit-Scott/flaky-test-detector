import React from 'react';
import { Zap } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  showPulse = true, 
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

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="relative">
        <Zap className={`${icon} text-blue-600`} />
        {showPulse && (
          <div className={`absolute ${dot} bg-green-500 rounded-full animate-pulse`}></div>
        )}
      </div>
      <span className={`${text} font-bold text-gray-900`}>
        Nix<span className="text-blue-600">bit</span>
      </span>
    </div>
  );
};

export default Logo;