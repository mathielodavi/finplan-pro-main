import React from 'react';

interface Column<T> {
  header: string;
  key: keyof T | string;
  render?: (item: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
}

const Table = <T extends { id?: string | number }>({ columns, data, onRowClick, isLoading }: TableProps<T>) => {
  if (isLoading) {
    return (
      <div className="w-full space-y-4 animate-pulse-soft">
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-50 rounded-2xl w-full" />)}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              {columns.map((col, i) => (
                <th key={i} className={`px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-${col.align || 'left'}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-8 py-20 text-center text-slate-400 font-bold uppercase text-[10px]">
                  Nenhum dado encontrado
                </td>
              </tr>
            ) : data.map((item, i) => (
              <tr 
                key={item.id || i} 
                onClick={() => onRowClick?.(item)}
                className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-indigo-50/30' : ''}`}
              >
                {columns.map((col, j) => (
                  <td key={j} className={`px-8 py-5 text-sm font-medium text-slate-700 text-${col.align || 'left'}`}>
                    {col.render ? col.render(item) : (item[col.key as keyof T] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Table;