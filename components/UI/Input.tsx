import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  as?: 'input' | 'select' | 'textarea';
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  as = 'input',
  className = '',
  ...props
}) => {
  const Component = as;

  // DESIGN.MD §7:
  // - Labels: 12px, semi-bold, posicionados acima do input
  // - Campos: altura 36-40px, border-radius 6-8px, borda cinza clara
  // - Foco: borda cor primária com ring suave
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: as === 'textarea' ? 'auto' : '36px',
    padding: as === 'textarea' ? '8px 12px' : '0 12px',
    backgroundColor: 'var(--bg-surface-2)',
    border: error ? '1px solid var(--danger)' : '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '13px',
    color: 'var(--text-main)',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  const handleFocus = (e: React.FocusEvent<HTMLElement>) => {
    (e.target as HTMLElement).style.borderColor = 'var(--primary)';
    (e.target as HTMLElement).style.boxShadow = '0 0 0 3px rgba(5, 150, 105, 0.12)';
  };

  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    (e.target as HTMLElement).style.borderColor = error ? 'var(--danger)' : 'var(--border)';
    (e.target as HTMLElement).style.boxShadow = 'none';
  };

  return (
    <div className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        // DESIGN.MD §7: label 12px, semi-bold, acima do input
        <label
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            lineHeight: 1,
          }}
        >
          {label}
        </label>
      )}
      <Component
        className={className}
        style={inputStyle}
        onFocus={handleFocus as any}
        onBlur={handleBlur as any}
        {...(props as any)}
      />
      {error ? (
        <p style={{ fontSize: '11px', color: 'var(--danger)', margin: 0 }}>
          {error}
        </p>
      ) : helperText ? (
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
};

export default Input;