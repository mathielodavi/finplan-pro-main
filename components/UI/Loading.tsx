import React from 'react';

export const Spinner = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };
  return (
    <div className={`${sizes[size]} animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600`} />
  );
};

export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`bg-slate-100 animate-pulse-soft rounded-xl ${className}`} />
);

export const LoadingPage = () => (
  <div className="flex flex-col items-center justify-center py-40 gap-4">
    <Spinner size="lg" />
    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Carregando ambiente...</p>
  </div>
);