import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className, onClick, ...props }) => (
  <div 
    onClick={onClick} 
    className={cn('bg-white border border-neutral-200/80 rounded-2xl shadow-sm overflow-hidden', className)}
    {...props}
  >
    {children}
  </div>
);

export default Card;
