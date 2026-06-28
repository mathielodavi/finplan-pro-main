import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading,
  leftIcon,
  rightIcon,
  className = '',
  ...props
}) => {
  // DESIGN.MD §7: border-radius 8px; altura máx. 40px; fonte semi-bold
  const base =
    'inline-flex items-center justify-center font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none';

  const variants: Record<string, string> = {
    // Cor primária via CSS var para garantir consistência com o token
    primary: 'text-[#0b0e14] hover:opacity-90',
    secondary: 'text-[color:var(--text-main)] hover:bg-[color:var(--bg-surface-3)]',
    outline: 'bg-transparent border text-[color:var(--text-main)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]',
    ghost: 'bg-transparent text-[color:var(--text-muted)] hover:bg-[color:var(--bg-surface-2)] hover:text-[color:var(--text-main)]',
    danger: 'text-white hover:opacity-90',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: { backgroundColor: 'var(--primary)' },
    secondary: { backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border)' },
    outline: { borderColor: 'var(--border)', backgroundColor: 'transparent' },
    ghost: {},
    danger: { backgroundColor: 'var(--danger)' },
  };

  // DESIGN.MD §7: altura 36-40px, border-radius 6-8px
  const sizes: Record<string, string> = {
    sm: 'px-3 h-8 text-xs gap-1.5',    // 32px altura
    md: 'px-4 h-9 text-sm gap-2',      // 36px altura
    lg: 'px-5 h-10 text-sm gap-2',     // 40px altura máx.
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      style={{ borderRadius: '8px', ...variantStyles[variant] }}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <>
          {leftIcon && <span className="opacity-80 flex-shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="opacity-80 flex-shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};

export default Button;