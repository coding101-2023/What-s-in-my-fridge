import React from 'react';

interface RetroCardProps {
  children: React.ReactNode;
  className?: string;
  color?: 'cream' | 'yellow' | 'red' | 'blue' | 'green' | 'white' | 'grey';
  onClick?: () => void;
}

const RetroCard: React.FC<RetroCardProps> = ({ children, className = '', color = 'white', onClick }) => {
  const colorClasses = {
    cream: 'bg-totoro-belly text-soot-black',
    yellow: 'bg-[#FFF9C4] text-soot-black', // Soft pastel yellow
    red: 'bg-[#FFCDD2] text-soot-black', // Soft pastel red
    blue: 'bg-sky-blue text-soot-black',
    green: 'bg-[#C8E6C9] text-soot-black', // Soft pastel green
    white: 'bg-white text-soot-black',
    grey: 'bg-totoro-grey text-white',
  };

  return (
    <div 
      onClick={onClick}
      className={`
        ${colorClasses[color]} 
        rounded-3xl
        shadow-soft
        border-none
        p-5
        transition-all duration-300 ease-in-out
        ${onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-soft-lg' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export default RetroCard;