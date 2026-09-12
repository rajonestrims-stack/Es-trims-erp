import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cpu, Database, CheckCircle2 } from 'lucide-react';

interface SplashScreenProps {
  appName?: string;
  subTitle?: string;
}

const BOOT_STEPS = [
  'Verifying Security Matrix & Authentication...',
  'Synchronizing Enterprise Approval Workflows...',
  'Connecting Real-time General Ledger & Stock Balances...',
  'Initializing Multi-tier Access Control Engine...',
  'Finalizing Workspace Presentation...'
];

export const SplashScreen: React.FC<SplashScreenProps> = ({
  appName = 'ES TRIMS LIMITED',
  subTitle = 'Intelligent Apparel ERP & Supply Chain Operating System'
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setStepIndex(prev => (prev + 1) % BOOT_STEPS.length);
    }, 1200);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 92) return 92;
        return prev + Math.floor(Math.random() * 12) + 5;
      });
    }, 300);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-slate-950 text-white select-none overflow-hidden p-6">
      {/* Dynamic Ambient Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft Radial Ambient Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-indigo-600/15 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] bg-blue-500/10 rounded-full blur-[110px]" />
        <div className="absolute bottom-1/4 right-1/3 translate-x-1/2 w-[340px] h-[340px] bg-violet-600/10 rounded-full blur-[120px]" />
        {/* Subtle grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }}
        />
      </div>

      {/* Top Header info */}
      <div className="relative z-10 w-full max-w-4xl flex items-center justify-between text-xs text-slate-400 font-mono pt-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
          <span className="font-semibold tracking-wider text-slate-300 uppercase">System Active</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400">Enterprise v4.2 Pro</span>
        </div>
      </div>

      {/* Center Hero Identity */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-md w-full my-auto space-y-7">
        {/* Logo with Orbital Rotating Rings */}
        <div className="relative flex items-center justify-center">
          {/* Outer Orbital Glowing Ring */}
          <div className="absolute -inset-4 rounded-full border border-indigo-500/20 border-dashed animate-[spin_18s_linear_infinite]" />
          <div className="absolute -inset-8 rounded-full border border-violet-500/15 animate-[spin_24s_linear_infinite_reverse]" />
          
          {/* Subtle Outer Glow */}
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-violet-600 opacity-30 blur-xl transition-all" />

          {/* Logo Container */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-slate-900/90 border border-white/10 p-3.5 shadow-2xl backdrop-blur-xl flex items-center justify-center">
            <img 
              src="https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE" 
              className="w-full h-full object-contain filter drop-shadow-[0_4px_16px_rgba(99,102,241,0.35)]" 
              alt="ES Trims Logo"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Brand Typography */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold tracking-widest uppercase">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span>Enterprise Suite</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-sans drop-shadow-sm">
            {appName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">
            {subTitle}
          </p>
        </div>

        {/* Progress & Live Milestone Bar */}
        <div className="w-full space-y-3 pt-2">
          {/* Progress Bar with Shimmer Light */}
          <div className="relative w-full h-2 rounded-full bg-slate-800/80 border border-slate-700/50 overflow-hidden shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 via-blue-400 to-emerald-400 rounded-full transition-all duration-300 ease-out relative overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              {/* Moving Shimmer Highlight */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
            </div>
          </div>

          {/* Dynamic Status Text */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <div className="flex items-center gap-2 font-mono truncate pr-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse flex-shrink-0" />
              <span className="truncate text-slate-300 text-[11px] font-medium transition-all duration-300">
                {BOOT_STEPS[stepIndex]}
              </span>
            </div>
            <span className="font-mono font-bold text-slate-300 text-xs flex-shrink-0">
              {progress}%
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Security & Architecture Badge */}
      <div className="relative z-10 w-full max-w-md flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400 border-t border-slate-800/60 pt-4 pb-2">
        <div className="flex items-center gap-1.5 text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Role-Based Multi-Level Approvals</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>End-to-End Realtime Sync</span>
        </div>
      </div>
    </div>
  );
};
