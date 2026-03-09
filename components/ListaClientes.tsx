
import React, { useState } from 'react';
import { Cliente, deletarCliente } from '../services/clienteService';
import { formatarMoeda } from '../utils/formatadores';
import Confirmacao from './Confirmacao';
import { Eye, Edit3, Trash2, ChevronRight, Inbox, TrendingUp, Activity } from 'lucide-react';
import Badge from './UI/Badge';

interface ListaClientesProps {
  clientes: any[]; // Usando any para suportar os campos processados (patrimonio_real, termometro)
  onEdit: (cliente: Cliente) => void;
  onView: (cliente: Cliente) => void;
  onRefresh: () => void;
}

const ListaClientes: React.FC<ListaClientesProps> = ({ clientes, onEdit, onView, onRefresh }) => {
  const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleteError(null);
    try {
      setDeleting(true);
      await deletarCliente(deleteTarget.id);
      onRefresh();
      setDeleteTarget(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Erro ao deletar cliente. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  if (clientes.length === 0) {
    return (
      <div className="bg-white p-16 rounded-3xl border border-slate-100 text-center space-y-4 shadow-sm">
        <div className="inline-flex items-center justify-center h-12 w-12 bg-slate-50 text-slate-200 rounded-xl">
          <Inbox size={24} />
        </div>
        <div>
          <p className="text-slate-900 font-bold uppercase text-[9px] tracking-widest">Nenhum cliente por aqui</p>
          <p className="text-slate-400 text-[11px] font-medium mt-1">Comece cadastrando um novo cliente para gerenciar sua carteira.</p>
        </div>
      </div>
    );
  }

  const getEtapaColor = (etapa?: string) => {
    if (!etapa) return 'neutral';
    const e = etapa.toLowerCase();
    if (e.includes('prospec')) return 'neutral';
    if (e.includes('apresent')) return 'info';
    if (e.includes('análise') || e.includes('analise')) return 'warning';
    if (e.includes('implement')) return 'emerald';
    if (e.includes('acompanh')) return 'success';
    return 'neutral';
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-50">
              <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Cliente</th>
              <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Origem</th>
              <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Termômetro</th>
              <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Etapa</th>
              <th className="px-4 py-3 text-right text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {clientes.map((c) => (
              <tr
                key={c.id}
                onClick={() => onView(c)}
                className="group transition-all hover:bg-slate-50/50 cursor-pointer"
              >
                <td className="px-4 py-3">
                  <div>
                    <span className="font-bold text-slate-900 text-[13px] block leading-none tracking-tight">
                      {c.nome}
                    </span>
                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-1.5 block opacity-0 group-hover:opacity-100 transition-opacity">
                      ID: {c.id.substring(0, 8)}
                    </span>
                  </div>
                </td>
                {/* Origem */}
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    {c.origem || c.origem_id ? (
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 inline-block w-fit">
                        {c.origem || 'Origem vinculada'}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-200 font-bold">—</span>
                    )}
                    {c.etiquetas_tags && c.etiquetas_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {c.etiquetas_tags.slice(0, 2).map((tag: string) => (
                          <span key={tag} className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">
                            {tag}
                          </span>
                        ))}
                        {c.etiquetas_tags.length > 2 && <span className="text-[8px] text-slate-300">+{c.etiquetas_tags.length - 2}</span>}
                      </div>
                    )}
                  </div>
                </td>
                {/* Termômetro */}
                <td className="px-4 py-3">
                  <div className="flex flex-row justify-center items-center gap-2">
                    <div className="flex items-center gap-1.5 w-24">
                      <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.termometro?.cor || '#94a3b8' }} />
                      <span className="text-[9px] font-black uppercase tracking-tighter truncate" style={{ color: c.termometro?.cor || '#94a3b8' }}>
                        {c.termometro?.status || 'SEM DADOS'}
                      </span>
                    </div>
                    <div className="h-1 w-12 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                      <div
                        className="h-full transition-all duration-1000"
                        style={{ width: `${c.termometro?.percentual || 0}%`, backgroundColor: c.termometro?.cor || '#cbd5e1' }}
                      />
                    </div>
                  </div>
                </td>
                {/* Etapa */}
                <td className="px-4 py-3">
                  <Badge variant={getEtapaColor(c.etapa_atual || c.status_atendimento) as any} size="sm">
                    {c.etapa_atual || c.status_atendimento || 'Prospecção'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1 opacity-20 group-hover:opacity-100 transition-all duration-300">
                    <button
                      onClick={(e) => { e.stopPropagation(); onView(c); }}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(c); }}
                      className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteError && (
        <div className="mx-4 mb-2 p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl border border-rose-100">
          {deleteError}
        </div>
      )}
      <Confirmacao
        isOpen={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteError(null); }}
        onConfirm={handleDelete}
        title="Excluir Cliente"
        message={`Todos os dados de ${deleteTarget?.nome} (contratos, reuniões, investimentos e histórico) serão apagados permanentemente. Esta ação não pode ser revertida.`}
        loading={deleting}
      />
    </div>
  );
};

export default ListaClientes;
