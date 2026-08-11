import React from 'react';
import { Briefcase } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas p-4 sm:p-6 lg:p-8">
      <div className="max-w-md w-full space-y-8 bg-surface p-10 rounded-[2rem] shadow-[var(--shadow-float)] border border-subtle animate-slide-up">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="h-14 w-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 text-[#0b0e14]">
               <Briefcase size={28} />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-main tracking-tight">{title}</h2>
          {subtitle && <p className="mt-2 text-xs text-faint font-bold uppercase tracking-widest">{subtitle}</p>}
        </div>
        <div className="mt-8">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;