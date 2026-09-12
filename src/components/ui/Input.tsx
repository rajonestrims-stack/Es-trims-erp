import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input 
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs md:text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:opacity-50 transition-all shadow-2xs',
      className
    )} 
    {...props} 
  />
));

Input.displayName = 'Input';
export default Input;
