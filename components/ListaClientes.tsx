
import React, { useState } from 'react';
import { Cliente, deletarCliente } from '../services/clienteService';
import { formatarMoeda, formatarData } from '../utils/formatadores';
import Confirmacao from './Confirmacao';
import Tooltip from './UI/Tooltip';
import { Eye, Edit3, Trash2, Inbox, AlertCircle, Clock, CalendarX, PauseCircle } from 'lucide-react';
import Badge from './UI/Badge';

interface ListaClientesProps {
  clientes: any[]; // Usando any para suportar os campos processados (patrimonio_real, termometro, proximaAcao)
  onEdit: (cliente: Cliente) => void;
  onView: (cliente: Cliente) => void;
  onRefresh: () => void;
}

const PROXIMA_ACAO_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  late: { icon: <AlertCircle size={14} />, color: 'var(--danger)', bg: 'rgba(248,113,113,0.14)' },
  upcoming: { icon: <Clock size={14} />, color: 'var(--primary)', bg: 'rgba(16,185,129,0.14)' },
  pending: { icon: <CalendarX size={14} />, color: 'var(--warning)', bg: 'rgba(251,191,36,0.14)' },
  pausado: { icon: <PauseCircle size={14} />, color: 'var(--warning)', bg: 'rgba(251,191,36,0.14)' },
};

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
      <div className="bg-surface p-12 rounded-xl border border-subtle text-center space-y-4 shadow-[var(--shadow-card)]">
        <div className="inline-flex items-center justify-center h-12 w-12 bg-surface-2 text-faint rounded-lg">
          <Inbox size={24} />
        </div>
        <div>
          <p className="text-[14px] text-main font-semibold">Nenhum cliente por aqui</p>
          <p className="text-[13px] text-muted font-medium mt-1">Comece cadastrando um novo cliente para gerenciar sua carteira.</p>
        </div>
      </div>
    );
  }

  const corProtecao = (pct: number) => pct >= 70 ? 'var(--primary)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)';

  const descricaoInadimplencia = (inad: any) => {
    if (!inad) return '';
    const partes = [`${inad.episodios} episódio(s)`];
    if (inad.diasMedios !== null && inad.diasMedios !== undefined) partes.push(`tempo médio ${inad.diasMedios}d`);
    if (inad.inadimplenteAgora) partes.push(`pausado há ${inad.diasAtuais}d`);
    return partes.join(' · ');
  };

  const descricaoProximaAcao = (c: any) => {
    const acao = c.proximaAcao;
    if (acao?.categoria === 'pausado') return `Atendimento pausado por inadimplência${c.inadimplencia ? ` — ${descricaoInadimplencia(c.inadimplencia)}` : ''}`;
    if (!acao) return 'Sem dados de agenda';
    if (acao.categoria === 'late') {
      const diffDays = acao.reuniao ? Math.max(0, Math.floor((Date.now() - new Date(acao.reuniao.data_reuniao).getTime()) / 86400000)) : 0;
      return acao.qtdAtrasadas > 1
        ? `${acao.qtdAtrasadas} reuniões atrasadas — última há ${diffDays}d`
        : `Atrasado há ${diffDays}d`;
    }
    if (acao.categoria === 'upcoming') {
      return `Próxima reunião em ${formatarData(acao.reuniao.data_reuniao, true)}`;
    }
    return 'Sem reunião agendada — agendar check-in';
  };

  return (
    <div className="bg-surface rounded-xl shadow-[var(--shadow-card)] border border-subtle overflow-hidden">
      {/* Abaixo de `md` a tabela de 7 colunas não cabe nem com scroll horizontal — vira lista de
          cartões com os mesmos dados agrupados por cliente. A partir de `md` volta a ser tabela. */}
      <div className="md:hidden divide-y divide-subtle">
        {clientes.map((c) => {
          const acaoCfg = PROXIMA_ACAO_CONFIG[c.proximaAcao?.categoria] || PROXIMA_ACAO_CONFIG.pending;
          const tagsExtras = (c.etiquetas_tags || []).slice(2);
          return (
            <div key={c.id} onClick={() => onView(c)} className="p-4 active:bg-surface-2 transition-colors cursor-pointer">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-surface-3 border border-subtle flex items-center justify-center text-[13px] font-bold text-muted shrink-0">
                    {c.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-main text-[14px] block leading-tight truncate">{c.nome}</span>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {c.origem ? <Badge variant="neutral" size="sm">{c.origem}</Badge> : null}
                      {c.inadimplencia?.inadimplenteAgora && <Badge variant="danger" size="sm">Inadimplente</Badge>}
                      {!c.temPlanoAtivo && <Badge variant="warning" size="sm">Sem plano ativo</Badge>}
                      {(c.etiquetas_tags || []).slice(0, 2).map((tag: string) => (
                        <Badge key={tag} variant="primary" size="sm">{tag}</Badge>
                      ))}
                      {tagsExtras.length > 0 && <Badge variant="neutral" size="sm">+{tagsExtras.length}</Badge>}
                    </div>
                  </div>
                </div>
                {/* Alvo de toque de 40px (vs. 28px na versão desktop) — sem hover no touch,
                    os botões ficam sempre visíveis em vez de aparecer com opacity no hover. */}
                <div className="flex gap-0.5 shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); onEdit(c); }} className="h-10 w-10 flex items-center justify-center text-faint active:text-main active:bg-surface-3 rounded-md transition-all">
                    <Edit3 size={16} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }} className="h-10 w-10 flex items-center justify-center text-faint active:text-[color:var(--danger)] active:bg-[rgba(248,113,113,0.12)] rounded-md transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 mt-3 pl-[46px]">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-faint block mb-0.5">Patrimônio líquido</span>
                  {c.patrimonio_liquido ? (
                    <span className="text-[13px] font-semibold" style={{ color: c.patrimonio_liquido < 0 ? 'var(--danger)' : 'var(--text-main)' }}>
                      {formatarMoeda(c.patrimonio_liquido)}
                    </span>
                  ) : <span className="text-[12px] text-faint">—</span>}
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-faint block mb-0.5">Termômetro</span>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.termometro?.cor || '#9ca3af' }} />
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: c.termometro?.cor || '#9ca3af' }}>
                      {c.termometro?.status || 'SEM DADOS'}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-faint block mb-0.5">Proteção</span>
                  <span className="text-[13px] font-bold" style={{ color: corProtecao(c.percentualProtecao || 0) }}>
                    {Math.round(c.percentualProtecao || 0)}%
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-faint block mb-0.5">Próxima ação</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="h-5 w-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: acaoCfg.bg, color: acaoCfg.color }}>
                      {React.cloneElement(acaoCfg.icon as any, { size: 11 })}
                    </div>
                    <span className="text-[11px] text-muted truncate">{descricaoProximaAcao(c)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-subtle">
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint">Cliente</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint">Origem</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint text-right">Patrimônio Líquido</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint text-center">Termômetro</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint text-center">Proteção</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint text-center">Próxima Ação</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-faint">Ações</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => {
              const acaoCfg = PROXIMA_ACAO_CONFIG[c.proximaAcao?.categoria] || PROXIMA_ACAO_CONFIG.pending;
              const tagsExtras = (c.etiquetas_tags || []).slice(2);

              return (
                <tr
                  key={c.id}
                  onClick={() => onView(c)}
                  className="group transition-colors duration-100 hover:bg-surface-2 cursor-pointer border-b border-subtle last:border-0"
                >
                  {/* Cliente */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-surface-3 border border-subtle flex items-center justify-center text-[12px] font-bold text-muted shrink-0">
                        {c.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-semibold text-main text-[13px] block leading-none">
                          {c.nome}
                        </span>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {c.inadimplencia?.inadimplenteAgora && (
                            <Tooltip text={descricaoInadimplencia(c.inadimplencia)}>
                              <Badge variant="danger" size="sm">Inadimplente</Badge>
                            </Tooltip>
                          )}
                          {!c.temPlanoAtivo && (
                            <Badge variant="warning" size="sm">Sem plano ativo</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Origem */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {c.origem ? (
                        <Badge variant="neutral" size="sm">{c.origem}</Badge>
                      ) : (
                        <span className="text-[11px] text-faint font-medium">—</span>
                      )}
                      {(c.etiquetas_tags || []).slice(0, 2).map((tag: string) => (
                        <Badge key={tag} variant="primary" size="sm">{tag}</Badge>
                      ))}
                      {tagsExtras.length > 0 && (
                        <Tooltip text={tagsExtras.join(', ')}>
                          <Badge variant="neutral" size="sm">+{tagsExtras.length}</Badge>
                        </Tooltip>
                      )}
                    </div>
                  </td>

                  {/* Patrimônio Líquido */}
                  <td className="px-4 py-3 text-right">
                    {c.patrimonio_liquido ? (
                      <span className="text-[13px] font-semibold" style={{ color: c.patrimonio_liquido < 0 ? 'var(--danger)' : 'var(--text-main)' }}>
                        {formatarMoeda(c.patrimonio_liquido)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-faint font-medium">—</span>
                    )}
                  </td>

                  {/* Termômetro */}
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <Tooltip text={c.termometro?.descricao || 'Sem dados de termômetro'}>
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.termometro?.cor || '#9ca3af' }} />
                          <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: c.termometro?.cor || '#9ca3af' }}>
                            {c.termometro?.status || 'SEM DADOS'}
                          </span>
                        </div>
                      </Tooltip>
                    </div>
                  </td>

                  {/* Proteção */}
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <Tooltip text="% médio de cobertura nos 3 pilares: Reserva de Emergência, Plano de Saúde e Seguros de Vida">
                        <span className="text-[12px] font-bold" style={{ color: corProtecao(c.percentualProtecao || 0) }}>
                          {Math.round(c.percentualProtecao || 0)}%
                        </span>
                      </Tooltip>
                    </div>
                  </td>

                  {/* Próxima Ação */}
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <Tooltip text={descricaoProximaAcao(c)}>
                        <div
                          className="h-7 w-7 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: acaoCfg.bg, color: acaoCfg.color }}
                        >
                          {acaoCfg.icon}
                        </div>
                      </Tooltip>
                    </div>
                  </td>

                  {/* Ações */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-0.5 opacity-30 group-hover:opacity-100 transition-all duration-300">
                      <button
                        onClick={(e) => { e.stopPropagation(); onView(c); }}
                        className="h-7 w-7 flex items-center justify-center text-faint hover:text-primary hover:bg-surface-3 rounded-md transition-all"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit(c); }}
                        className="h-7 w-7 flex items-center justify-center text-faint hover:text-main hover:bg-surface-3 rounded-md transition-all"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                        className="h-7 w-7 flex items-center justify-center text-faint hover:text-[color:var(--danger)] rounded-md transition-all"
                        style={{ transition: 'all .15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(248,113,113,0.12)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {deleteError && (
        <div className="mx-4 mb-2 p-3 text-[color:var(--danger)] text-xs font-semibold rounded-xl border border-subtle" style={{ backgroundColor: 'rgba(248,113,113,0.10)' }}>
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
