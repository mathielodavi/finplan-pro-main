import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'primary' | 'emerald';
  size?: 'sm' | 'md';
  className?: string;
}

// DESIGN.MD §8: formato pílula (border-radius 9999px), fundo 10% opacidade da cor semântica,
// texto em tom escuro da mesma cor, sem borda externa. Fonte 11px, bold.
const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', size = 'md', className = '' }) => {
  const variantStyles: Record<string, React.CSSProperties> = {
    success:  { backgroundColor: 'rgba(52, 211, 153, 0.14)', color: '#6ee7b7' },
    primary:  { backgroundColor: 'rgba(16, 185, 129, 0.14)', color: '#34d399' },
    info:     { backgroundColor: 'rgba(96, 165, 250, 0.14)', color: '#93c5fd' },
    warning:  { backgroundColor: 'rgba(251, 191, 36, 0.14)', color: '#fcd34d' },
    danger:   { backgroundColor: 'rgba(248, 113, 113, 0.14)', color: '#fca5a5' },
    neutral:  { backgroundColor: 'rgba(155, 161, 176, 0.14)', color: '#c2c7d2' },
    emerald:  { backgroundColor: 'rgba(16, 185, 129, 0.14)', color: '#34d399' },
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { fontSize: '10px', padding: '1px 8px' },
    md: { fontSize: '11px', padding: '2px 10px' },
  };

  return (
    <span
      className={`inline-flex items-center font-bold whitespace-nowrap ${className}`}
      style={{
        borderRadius: '9999px',       // pill
        fontWeight: 700,
        lineHeight: 1.5,
        ...variantStyles[variant],
        ...sizeStyles[size],
      }}
    >
      {children}
    </span>
  );
};

export default Badge;