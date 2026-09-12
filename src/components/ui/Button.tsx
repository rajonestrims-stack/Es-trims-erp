import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success' | 'indigo';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ 
  className, 
  variant = 'primary', 
  size = 'md', 
  ...props 
}, ref) => {
  const variants = {
    primary: 'bg-neutral-900 text-white hover:bg-neutral-800 shadow-xs focus-visible:ring-neutral-900',
    indigo: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs focus-visible:ring-indigo-600',
    secondary: 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200/80 focus-visible:ring-neutral-400',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-xs focus-visible:ring-rose-600',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs focus-visible:ring-emerald-600',
    ghost: 'bg-transparent hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 focus-visible:ring-neutral-400',
    outline: 'bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 hover:text-neutral-900 shadow-xs focus-visible:ring-neutral-400'
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-xs font-semibold',
    md: 'px-4 py-2 text-sm font-semibold',
    lg: 'px-5 py-2.5 text-base font-semibold',
    icon: 'p-2'
  };
  
  return (
    <button 
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 cursor-pointer',
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        className
      )} 
      {...props} 
    />
  );
});

Button.displayName = 'Button';
export default Button;
