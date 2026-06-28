import React from 'react';

interface Column<T> {
  header: string;
  key: keyof T | string;
  render?: (item: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  /** Remove o wrapper de card (útil quando a tabela já está dentro de um Card) */
  bare?: boolean;
}

const Table = <T extends { id?: string | number }>({
  columns,
  data,
  onRowClick,
  isLoading,
  bare = false,
}: TableProps<T>) => {
  // DESIGN.MD §6: loading skeleton com altura de linha reduzida
  if (isLoading) {
    return (
      <div className="w-full space-y-2 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="w-full"
            style={{
              height: '44px',
              borderRadius: '6px',
              backgroundColor: 'var(--border-light)',
            }}
          />
        ))}
      </div>
    );
  }

  const inner = (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        {/* DESIGN.MD §6: thead — 12px, uppercase, semi-bold, cor muted, fundo #F9FAFB, sem bordas verticais */}
        <thead>
          <tr style={{ backgroundColor: '#F9FAFB' }}>
            {columns.map((col, i) => (
              <th
                key={i}
                className={`text-${col.align || 'left'}`}
                style={{
                  padding: '10px 16px',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-muted)',
                  borderBottom: '1px solid var(--border)',
                  width: col.width,
                  whiteSpace: 'nowrap',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        {/* DESIGN.MD §6: rows — py reduzido (12px), borda base sutil, hover #F3F4F6 */}
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="text-center"
                style={{
                  padding: '48px 16px',
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                }}
              >
                Nenhum dado encontrado
              </td>
            </tr>
          ) : (
            data.map((item, i) => (
              <tr
                key={item.id ?? i}
                onClick={() => onRowClick?.(item)}
                className={`transition-colors duration-100 ${onRowClick ? 'cursor-pointer' : ''}`}
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => {
                  if (onRowClick) (e.currentTarget as HTMLElement).style.backgroundColor = '#F3F4F6';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                {columns.map((col, j) => (
                  <td
                    key={j}
                    className={`text-${col.align || 'left'}`}
                    style={{
                      padding: '12px 16px',
                      fontSize: '13px',
                      color: 'var(--text-main)',
                    }}
                  >
                    {col.render
                      ? col.render(item)
                      : (item[col.key as keyof T] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  if (bare) return inner;

  // DESIGN.MD §5: card wrapper com radius 12px, sombra ultra-suave
  return (
    <div
      className="bg-surface overflow-hidden"
      style={{
        borderRadius: '12px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {inner}
    </div>
  );
};

export default Table;