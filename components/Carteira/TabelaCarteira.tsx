import React, { useState, useMemo } from 'react';
import { Landmark, TrendingUp, Search, Briefcase, Edit3, Trash2, CheckCircle2, Clock } from 'lucide-react';
import Badge from '../UI/Badge';
import Confirmacao from '../Confirmacao';
import { carteiraRecomendadaService } from '../../services/carteiraRecomendadaService';
import { normalizarTexto, diasDesde } from '../../utils/formatadores';
import { GrupoAtivo } from './AtivoRecomendadoDrawer';

interface TabelaCarteiraProps {
   ativos: any[];
   onEditGrupo: (grupo: GrupoAtivo) => void;
   onRefresh: () => void;
}

/** Chave de identidade do ativo (mesma de ConsultaCarteira): ticker → cnpj → nome normalizado. */
const chaveAtivo = (a: any) => (a.ticker || a.cnpj || normalizarTexto(a.nome_ativo || '')).toString();

const OrigemIcon = ({ origem }: { origem: string }) => (
   <div className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-surface-2 border border-subtle text-faint">
      {origem === 'bolsa' ? <TrendingUp size={14} /> : origem === 'fundo' ? <Briefcase size={14} /> : <Landmark size={14} />}
   </div>
);

const TabelaCarteira: React.FC<TabelaCarteiraProps> = ({ ativos, onEditGrupo, onRefresh }) => {
   const [busca, setBusca] = useState('');
   const [filtroEstrategia, setFiltroEstrategia] = useState('Todas');
   const [filtroFaixa, setFiltroFaixa] = useState('Todas');
   const [removerAlvo, setRemoverAlvo] = useState<any | null>(null);
   const [removerGrupo, setRemoverGrupo] = useState<any | null>(null);
   const [removendo, setRemovendo] = useState(false);
   const [okId, setOkId] = useState<string | null>(null);

   const estrategias = useMemo(() => ['Todas', ...Array.from(new Set(ativos.map(a => a.estrategias_base?.nome).filter(Boolean)))], [ativos]);

   // Faixas interrelacionadas: quando uma estratégia é escolhida, só as faixas dela; senão, todas.
   const faixas = useMemo(() => {
      const rel = ativos.filter(a => filtroEstrategia === 'Todas' || a.estrategias_base?.nome === filtroEstrategia);
      return ['Todas', ...Array.from(new Set(rel.map(a => a.estrategias_faixas?.nome).filter(Boolean)))];
   }, [ativos, filtroEstrategia]);

   // Se a faixa selecionada deixa de existir na estratégia escolhida, reseta para "Todas".
   React.useEffect(() => { if (!faixas.includes(filtroFaixa)) setFiltroFaixa('Todas'); }, [faixas, filtroFaixa]);

   const colMatchFiltro = (c: any) =>
      (filtroEstrategia === 'Todas' || c.estrategias_base?.nome === filtroEstrategia) &&
      (filtroFaixa === 'Todas' || c.estrategias_faixas?.nome === filtroFaixa);

   // Agrupa as linhas (colocações) por ativo, já aplicando busca (por ativo) e filtros (por colocação).
   const grupos = useMemo(() => {
      const map = new Map<string, any>();
      ativos.forEach(a => {
         const matchBusca = (a.nome_ativo || '').toLowerCase().includes(busca.toLowerCase()) ||
            (a.ticker && a.ticker.toLowerCase().includes(busca.toLowerCase()));
         if (!matchBusca || !colMatchFiltro(a)) return;
         const k = chaveAtivo(a);
         if (!map.has(k)) {
            map.set(k, {
               chave: k,
               nome_ativo: a.nome_ativo,
               origem_ativo: a.origem_ativo,
               ticker: a.ticker,
               cnpj: a.cnpj,
               tipo: a.tipo,
               asset_classe_nome: a.asset_classe_nome,
               instituicoes: a.instituicoes,
               variacoes_fundo: a.variacoes_fundo,
               observacoes: a.observacoes,
               colocacoes: [] as any[],
               todosIds: [] as string[],
            });
         }
         map.get(k).colocacoes.push(a);
      });
      // Guarda TODOS os ids do ativo (independente de filtro) para a exclusão total.
      const idsPorChave = new Map<string, string[]>();
      ativos.forEach(a => {
         const k = chaveAtivo(a);
         if (!idsPorChave.has(k)) idsPorChave.set(k, []);
         idsPorChave.get(k)!.push(a.id);
      });
      const arr = Array.from(map.values());
      arr.forEach(g => { g.todosIds = idsPorChave.get(g.chave) || []; });
      return arr.sort((x, y) => (x.nome_ativo || '').localeCompare(y.nome_ativo || '', 'pt-BR'));
   }, [ativos, busca, filtroEstrategia, filtroFaixa]);

   const filtrandoColocacoes = filtroEstrategia !== 'Todas' || filtroFaixa !== 'Todas';

   const handleOk = async (id: string) => {
      setOkId(id);
      try { await carteiraRecomendadaService.marcarAtualizado(id); onRefresh(); }
      catch { alert('Erro ao marcar como atualizado.'); }
      finally { setOkId(null); }
   };

   const handleRemover = async () => {
      if (!removerAlvo) return;
      setRemovendo(true);
      try { await carteiraRecomendadaService.deletarAtivoRecomendado(removerAlvo.id); setRemoverAlvo(null); onRefresh(); }
      catch { alert('Erro ao remover colocação.'); }
      finally { setRemovendo(false); }
   };

   const handleRemoverGrupo = async () => {
      if (!removerGrupo) return;
      setRemovendo(true);
      try { await carteiraRecomendadaService.deletarGrupoAtivo(removerGrupo.todosIds); setRemoverGrupo(null); onRefresh(); }
      catch { alert('Erro ao excluir ativo.'); }
      finally { setRemovendo(false); }
   };

   const badgeIdade = (atualizadoEm?: string) => {
      const dias = diasDesde(atualizadoEm);
      if (dias === null) return <span className="text-[10px] font-semibold text-[color:var(--warning)]">sem data</span>;
      const defasado = dias > 30;
      return (
         <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: defasado ? 'var(--warning)' : 'var(--primary)' }}>
            <Clock size={10} /> {dias === 0 ? 'hoje' : `há ${dias}d`}
         </span>
      );
   };

   return (
      <div className="space-y-6 animate-fade-in">
         <div className="flex flex-col md:flex-row gap-3 justify-between items-center bg-surface p-3 px-4 rounded-xl border border-subtle">
            <div className="flex items-center gap-2 w-full md:w-80 relative group">
               <Search className="absolute left-3 top-2.5 h-4 w-4 text-faint group-focus-within:text-primary transition-colors" />
               <input
                  type="text"
                  placeholder="Buscar por nome ou ticker..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="w-full pl-9 pr-3 h-9 bg-surface-2 border border-subtle rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-semibold text-[12px] text-main placeholder:text-faint"
               />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
               <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-faint uppercase tracking-wider shrink-0">Estratégia</span>
                  <select value={filtroEstrategia} onChange={e => setFiltroEstrategia(e.target.value)} className="h-9 px-2.5 bg-surface-2 border border-subtle rounded-lg text-[12px] font-semibold text-main outline-none focus:border-primary transition-colors">
                     {estrategias.map(est => <option key={est} value={est}>{est}</option>)}
                  </select>
               </div>
               <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-faint uppercase tracking-wider shrink-0">Faixa</span>
                  <select value={filtroFaixa} onChange={e => setFiltroFaixa(e.target.value)} className="h-9 px-2.5 bg-surface-2 border border-subtle rounded-lg text-[12px] font-semibold text-main outline-none focus:border-primary transition-colors">
                     {faixas.map(fx => <option key={fx} value={fx}>{fx}</option>)}
                  </select>
               </div>
            </div>
         </div>

         {filtrandoColocacoes && (
            <p className="text-[11px] text-faint -mt-2">Mostrando apenas as colocações que batem com os filtros. "Editar" abre o ativo com todas as suas colocações.</p>
         )}

         <div className="space-y-3">
            {grupos.map(g => (
               <div key={g.chave} className="bg-surface rounded-xl border border-subtle overflow-hidden">
                  {/* Cabeçalho do ativo */}
                  <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-subtle">
                     <div className="flex items-center gap-3 min-w-0">
                        <OrigemIcon origem={g.origem_ativo} />
                        <div className="min-w-0">
                           <p className="font-semibold text-main text-[13px] tracking-tight leading-none mb-1 truncate">{g.nome_ativo}</p>
                           <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase tracking-wider">{g.asset_classe_nome || '—'}</span>
                              <span className="text-[10px] text-faint font-medium">{g.ticker || g.cnpj || g.tipo || 'Custódia'}</span>
                              {g.todosIds.length > 1 && <span className="text-[10px] text-faint font-medium">· {g.todosIds.length} colocações</span>}
                           </div>
                        </div>
                     </div>
                     <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => onEditGrupo(g as GrupoAtivo)} className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-colors">
                           <Edit3 size={13} /> Editar
                        </button>
                        <button onClick={() => setRemoverGrupo(g)} title="Excluir o ativo de todas as estratégias e faixas" className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-subtle text-[color:var(--danger)] font-semibold text-[12px] hover:bg-surface-2 transition-colors">
                           <Trash2 size={13} /> Excluir ativo
                        </button>
                     </div>
                  </div>

                  {/* Colocações */}
                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead>
                           <tr className="bg-surface-2 border-b border-subtle">
                              <th className="px-5 py-2 text-[10px] font-semibold uppercase text-faint tracking-wider">Estratégia / Faixa</th>
                              <th className="px-5 py-2 text-[10px] font-semibold uppercase text-faint tracking-wider text-center">Alocação</th>
                              <th className="px-5 py-2 text-[10px] font-semibold uppercase text-faint tracking-wider">Instituições</th>
                              <th className="px-5 py-2 text-[10px] font-semibold uppercase text-faint tracking-wider">Atualização</th>
                              <th className="px-5 py-2 text-right"></th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle text-[13px]">
                           {g.colocacoes.map((c: any) => (
                              <tr key={c.id} className="hover:bg-surface-2/50 transition-colors group">
                                 <td className="px-5 py-2.5">
                                    <p className="font-semibold text-main text-[12px] leading-none mb-0.5">{c.estrategias_base?.nome || '—'}</p>
                                    <p className="text-[10px] text-faint font-medium">{c.estrategias_faixas?.nome || '—'}</p>
                                 </td>
                                 <td className="px-5 py-2.5 text-center"><span className="text-[13px] font-bold text-main">{c.alocacao}%</span></td>
                                 <td className="px-5 py-2.5">
                                    {c.instituicoes ? (
                                       <div className="flex flex-wrap gap-1">{c.instituicoes.split(',').filter(Boolean).map((inst: string) => <Badge key={inst} variant="neutral" size="sm">{inst.trim()}</Badge>)}</div>
                                    ) : <span className="text-[10px] font-semibold text-faint uppercase tracking-wider">Livre</span>}
                                 </td>
                                 <td className="px-5 py-2.5">{badgeIdade(c.atualizado_em)}</td>
                                 <td className="px-5 py-2.5 text-right">
                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                       <button onClick={() => handleOk(c.id)} disabled={okId === c.id} title="Confirmar que está atualizado (renova a data)" className="flex items-center gap-1 px-2 h-7 rounded-md text-[11px] font-semibold text-[color:var(--primary)] hover:bg-[rgba(16,185,129,0.12)] transition-colors disabled:opacity-50">
                                          <CheckCircle2 size={13} /> OK
                                       </button>
                                       <button onClick={() => setRemoverAlvo(c)} title="Remover esta colocação" className="p-1.5 text-faint hover:text-[color:var(--danger)] rounded-md transition-colors"><Trash2 size={14} /></button>
                                    </div>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            ))}
            {grupos.length === 0 && (
               <div className="py-16 text-center text-faint font-medium text-[12px]">Nenhum ativo encontrado.</div>
            )}
         </div>

         <Confirmacao
            isOpen={!!removerAlvo}
            onClose={() => setRemoverAlvo(null)}
            onConfirm={handleRemover}
            title="Remover colocação"
            message={`Remover ${removerAlvo?.nome_ativo || 'o ativo'} da estratégia "${removerAlvo?.estrategias_base?.nome || '—'}" / faixa "${removerAlvo?.estrategias_faixas?.nome || '—'}"? As demais colocações do ativo permanecem.`}
            loading={removendo}
         />

         <Confirmacao
            isOpen={!!removerGrupo}
            onClose={() => setRemoverGrupo(null)}
            onConfirm={handleRemoverGrupo}
            title="Excluir ativo"
            message={`Excluir "${removerGrupo?.nome_ativo || 'o ativo'}" de TODAS as estratégias e faixas (${removerGrupo?.todosIds?.length || 0} colocação(ões))? Esta ação não pode ser desfeita.`}
            loading={removendo}
         />
      </div>
   );
};

export default TabelaCarteira;
