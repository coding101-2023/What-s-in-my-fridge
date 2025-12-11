import React from 'react';

interface RetroCardProps {
  children: React.ReactNode;
  className?: string;
  color?: 'cream' | 'yellow' | 'red' | 'blue' | 'green' | 'white';
  onClick?: () => void;
}

const RetroCard: React.FC<RetroCardProps> = ({ children, className = '', color = 'white', onClick }) => {
  const colorClasses = {
    cream: 'bg-mario-cream',
    yellow: 'bg-mario-yellow',
    red: 'bg-mario-red text-white',
    blue: 'bg-mario-blue text-white',
    green: 'bg-mario-green text-white',
    white: 'bg-white',
  };

  return (
    <div 
      onClick={onClick}
      className={`
        ${colorClasses[color]} 
        border-4 border-black 
        shadow-pixel 
        p-4 
        transition-transform active:translate-x-1 active:translate-y-1 active:shadow-none
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export default RetroCard;