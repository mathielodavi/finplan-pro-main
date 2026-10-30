import React, { useState } from 'react';
import { ChevronDown, Eye, Plus } from 'lucide-react';
import { LinhaProtecao } from '../../utils/protecaoTabela';
import { formatarData, formatarMoeda } from '../../utils/formatadores';

export type NovaCobertura = 'plano' | 'vida' | 'imobiliario' | 'veicular' | 'empresarial' | 'profissional';

const OPCOES_COBERTURA: { id: NovaCobertura; label: string }[] = [
  { id: 'plano', label: 'Plano de saúde' },
  { id: 'vida', label: 'Seguro de vida' },
  { id: 'imobiliario', label: 'Seguro imobiliário' },
  { id: 'veicular', label: 'Seguro veicular' },
  { id: 'empresarial', label: 'Seguro empresarial' },
  { id: 'profissional', label: 'Proteção profissional' },
];

interface Props {
  titulo: string;
  linhas: LinhaProtecao[];
  onAdicionar: (tipo: NovaCobertura) => void;
  onVisualizar: (linha: LinhaProtecao) => void;
}

const exibir = (valor: number | string | null) =>
  valor === null ? '—' : typeof valor === 'number' ? formatarMoeda(valor) : valor;

const thCls = 'px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint whitespace-nowrap';

const TabelaProtecao: React.FC<Props> = ({ titulo, linhas, onAdicionar, onVisualizar }) => {
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <section className="bg-surface rounded-xl border border-subtle">
      <div className="px-4 py-3 border-b border-subtle flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-main truncate">{titulo}</h3>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuAberto(v => !v)}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[12px] font-semibold text-white hover:opacity-90 transition-all"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <Plus size={14} /> Adicionar cobertura <ChevronDown size={13} />
          </button>
          {menuAberto && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuAberto(false)} />
              <div className="absolute right-0 top-full mt-1 z-30 w-52 bg-surface border border-subtle rounded-lg shadow-lg overflow-hidden">
                {OPCOES_COBERTURA.map(o => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => { setMenuAberto(false); onAdicionar(o.id); }}
                    className="w-full text-left px-3 py-2 text-[12px] font-medium text-main hover:bg-surface-2 transition-colors"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-subtle">
              <th className={thCls}>Proteção</th>
              <th className={thCls}>Pilar</th>
              <th className={thCls}>Vencimento</th>
              <th className={`${thCls} text-right`}>Recomendado</th>
              <th className={`${thCls} text-right`}>Contratado</th>
              <th className={`${thCls} text-right`}>Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {linhas.map(l => (
              <tr key={l.id} className="hover:bg-surface-2 transition-colors">
                <td className="px-4 py-2.5 text-[13px] font-semibold text-main whitespace-nowrap">{l.protecao}</td>
                <td className="px-4 py-2.5 text-[12px] text-muted whitespace-nowrap">{l.pilar}</td>
                <td className="px-4 py-2.5 text-[12px] whitespace-nowrap" style={{ color: l.vencido ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {l.vencimento ? `${formatarData(l.vencimento)}${l.vencido ? ' · vencido' : ''}` : '—'}
                </td>
                <td className="px-4 py-2.5 text-[13px] font-semibold text-main text-right whitespace-nowrap">{exibir(l.recomendado)}</td>
                <td className="px-4 py-2.5 text-[13px] font-semibold text-[color:var(--primary)] text-right whitespace-nowrap">{exibir(l.contratado)}</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onVisualizar(l)}
                    className="inline-flex items-center gap-1 px-2 h-7 rounded-md text-[11px] font-semibold text-muted hover:text-[color:var(--primary)] hover:bg-surface-3 transition-colors"
                  >
                    <Eye size={13} /> Visualizar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default TabelaProtecao;
