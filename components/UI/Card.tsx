import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  /** Card de destaque escuro — usado exclusivamente para KPI principal (DESIGN.MD §5) */
  dark?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  actions,
  className = '',
  noPadding,
  dark = false,
}) => {
  // DESIGN.MD §5: radius 12-16px, sombra ultra-suave, padding 20-24px, sem bordas pesadas
  const cardBase = 'overflow-hidden transition-shadow duration-150';

  const cardStyle: React.CSSProperties = dark
    ? {
        backgroundColor: 'var(--bg-surface-2)',   // variante de destaque
        borderRadius: '16px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
      }
    : {
        backgroundColor: 'var(--bg-surface)',
        borderRadius: '12px',
        boxShadow: 'var(--shadow-card)',
        border: '1px solid var(--border)',
      };

  const hasHeader = title || actions || subtitle;

  return (
    <div className={`${cardBase} ${className}`} style={cardStyle}>
      {hasHeader ? (
        <div
          className="flex items-center justify-between gap-4"
          style={{
            padding: '16px 20px',
            borderBottom: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid var(--border)',
          }}
        >
          <div className="min-w-0">
            {title && (
              <h3
                className="font-semibold truncate"
                style={{
                  fontSize: '14px',
                  color: dark ? '#ffffff' : 'var(--text-main)',
                  lineHeight: 1.3,
                }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p
                className="mt-0.5 truncate"
                style={{
                  fontSize: '12px',
                  color: dark ? '#9CA3AF' : 'var(--text-muted)',
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
        </div>
      ) : null}

      <div style={noPadding ? {} : { padding: '20px' }} className="relative">
        {children}
      </div>
    </div>
  );
};

export default Card;