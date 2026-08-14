import React, { useState, useEffect } from 'react';
import { carteiraRecomendadaService, AtivoRecomendado, chaveVariacaoAtivo } from '../../services/carteiraRecomendadaService';
import { configService } from '../../services/configuracoesService';
import { formatarCNPJ, normalizarTexto } from '../../utils/formatadores';
import SidePanel from '../UI/SidePanel';
import { Plus, Trash2, CheckCircle2, AlertCircle, Layers } from 'lucide-react';

/** Colocação = uma linha (estratégia × faixa) com sua própria alocação — compartilhada por TODAS as variações do ativo. */
interface ColocacaoState {
  uid: string;
  estrategia_id: string;
  faixa_id: string;
  alocacao: number;
}

/** Variação = um ticker/CNPJ/tipo diferente do MESMO ativo (ex.: classes de acesso de um fundo,
 *  ou opções equivalentes como ETF FIXA11/IDKA11). Todas as variações herdam os dados
 *  compartilhados do ativo e as mesmas colocações (estratégia × faixa × alocação). */
interface VariacaoState {
  uid: string;
  ticker: string;
  cnpj: string;
  tipo: string;
  variacoes_fundo: string;
}

/** Grupo de um ativo = seus dados compartilhados + as linhas (variação × colocação) do banco. */
export interface GrupoAtivo {
  nome_ativo: string;
  origem_ativo: 'bolsa' | 'fundo' | 'bancario';
  asset_classe_nome: string;
  instituicoes?: string;
  observacoes?: string;
  linhas: AtivoRecomendado[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  grupoInicial: GrupoAtivo | null; // null = novo ativo
  onSaved: () => void;
}

const fLabel = 'block text-[11px] font-semibold text-muted mb-1.5';
const fInput = 'w-full px-3 h-9 bg-surface-2 border border-subtle rounded-lg font-semibold text-[13px] text-main outline-none focus:border-primary transition-colors';
const fSection = 'text-[11px] font-semibold text-faint uppercase tracking-wider';

const newUid = () => Math.random().toString(36).slice(2);
const variacaoVazia = (): VariacaoState => ({ uid: newUid(), ticker: '', cnpj: '', tipo: '', variacoes_fundo: '' });
const identificadorVariacao = (v: VariacaoState) => (v.ticker || v.cnpj || v.tipo || '').trim();

const AtivoRecomendadoDrawer: React.FC<Props> = ({ open, onClose, grupoInicial, onSaved }) => {
  const [estrategias, setEstrategias] = useState<any[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [bancos, setBancos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Estado compartilhado do ativo
  const [nomeAtivo, setNomeAtivo] = useState('');
  const [origem, setOrigem] = useState<'bolsa' | 'fundo' | 'bancario'>('bolsa');
  const [classe, setClasse] = useState('');
  const [instituicoes, setInstituicoes] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState('');

  const [variacoesState, setVariacoesState] = useState<VariacaoState[]>([]);
  const [colocacoes, setColocacoes] = useState<ColocacaoState[]>([]);
  // ids[variacaoUid][colocacaoUid] = id da linha no banco — para saber o que atualizar/remover ao salvar.
  const [idsMap, setIdsMap] = useState<Record<string, Record<string, string>>>({});
  const [idsOriginais, setIdsOriginais] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [ests, alocs, bcs] = await Promise.all([
          configService.getEstrategias(),
          configService.getAssetAllocations(),
          configService.getBancos(),
        ]);
        setEstrategias(ests || []);
        const nomesClasses = Array.from(new Set((alocs || []).flatMap((a: any) => (a.classes || []).map((c: any) => c.nome)).filter(Boolean)));
        setClasses(nomesClasses as string[]);
        setBancos((bcs || []).map((b: any) => b.nome));
      } catch (err) { console.error('Erro ao carregar metadados da carteira:', err); }
    })();
  }, [open]);

  // Semeia o formulário a partir do grupo em edição (ou zera para novo). Deriva a lista de
  // variações e a lista (compartilhada) de colocações a partir das linhas brutas do banco.
  useEffect(() => {
    if (!open) return;
    if (grupoInicial) {
      setNomeAtivo(grupoInicial.nome_ativo || '');
      setOrigem((grupoInicial.origem_ativo as any) || 'bolsa');
      setClasse(grupoInicial.asset_classe_nome || '');
      setInstituicoes((grupoInicial.instituicoes || '').split(',').map(s => s.trim()).filter(Boolean));
      setObservacoes(grupoInicial.observacoes || '');

      const linhas = grupoInicial.linhas || [];

      // Variações únicas por identificador + rótulo (ver `chaveVariacaoAtivo`): só o identificador
      // colapsaria variações legítimas que compartilham `tipo` (ex.: dois CDBs de bancos diferentes),
      // e as linhas colapsadas seriam apagadas no save seguinte.
      const variacoesPorIdent = new Map<string, VariacaoState>();
      linhas.forEach(l => {
        const ident = chaveVariacaoAtivo(l) || l.id || '';
        if (!variacoesPorIdent.has(ident)) {
          variacoesPorIdent.set(ident, { uid: newUid(), ticker: l.ticker || '', cnpj: l.cnpj || '', tipo: l.tipo || '', variacoes_fundo: l.variacoes_fundo || '' });
        }
      });
      const vars = Array.from(variacoesPorIdent.values());
      setVariacoesState(vars.length ? vars : [variacaoVazia()]);

      // Colocações únicas por estratégia × faixa (alocação compartilhada — igual em todas as variações na prática).
      const colocacoesPorCombo = new Map<string, ColocacaoState>();
      linhas.forEach(l => {
        const combo = `${l.estrategia_id}|${l.faixa_id}`;
        if (!colocacoesPorCombo.has(combo)) {
          colocacoesPorCombo.set(combo, { uid: newUid(), estrategia_id: l.estrategia_id, faixa_id: l.faixa_id, alocacao: Number(l.alocacao) || 0 });
        }
      });
      setColocacoes(Array.from(colocacoesPorCombo.values()));

      // Mapeia cada linha existente ao par (variação uid, colocação uid) para diff no save.
      const ids: Record<string, Record<string, string>> = {};
      linhas.forEach(l => {
        const ident = chaveVariacaoAtivo(l) || l.id || '';
        const combo = `${l.estrategia_id}|${l.faixa_id}`;
        const vUid = variacoesPorIdent.get(ident)?.uid;
        const cUid = colocacoesPorCombo.get(combo)?.uid;
        if (vUid && cUid && l.id) {
          if (!ids[vUid]) ids[vUid] = {};
          ids[vUid][cUid] = l.id;
        }
      });
      setIdsMap(ids);
      setIdsOriginais(linhas.map(l => l.id!).filter(Boolean));
    } else {
      setNomeAtivo(''); setOrigem('bolsa'); setClasse(''); setInstituicoes([]); setObservacoes('');
      setVariacoesState([variacaoVazia()]);
      setColocacoes([{ uid: newUid(), estrategia_id: '', faixa_id: '', alocacao: 0 }]);
      setIdsMap({});
      setIdsOriginais([]);
    }
    setErro(null);
  }, [open, grupoInicial]);

  const faixasDaEstrategia = (estrategiaId: string) => estrategias.find(e => e.id === estrategiaId)?.faixas || [];

  const addVariacao = () => setVariacoesState(prev => [...prev, variacaoVazia()]);
  const removeVariacao = (uid: string) => setVariacoesState(prev => prev.filter(v => v.uid !== uid));
  const updateVariacao = (uid: string, patch: Partial<VariacaoState>) => setVariacoesState(prev => prev.map(v => v.uid === uid ? { ...v, ...patch } : v));

  const addColocacao = () => setColocacoes(prev => [...prev, { uid: newUid(), estrategia_id: '', faixa_id: '', alocacao: 0 }]);
  const removeColocacao = (uid: string) => setColocacoes(prev => prev.filter(c => c.uid !== uid));
  const updateColocacao = (uid: string, patch: Partial<ColocacaoState>) => setColocacoes(prev => prev.map(c => c.uid === uid ? { ...c, ...patch } : c));

  const toggleInstituicao = (nome: string) => setInstituicoes(prev => prev.includes(nome) ? prev.filter(n => n !== nome) : [...prev, nome]);

  const validar = (): string | null => {
    if (!nomeAtivo.trim()) return 'Informe o nome do ativo.';
    if (!classe) return 'Selecione a classe de ativo.';
    if (variacoesState.length === 0) return 'Adicione ao menos uma variação (ticker, CNPJ ou tipo) do ativo.';
    if (colocacoes.length === 0) return 'Adicione ao menos uma colocação (estratégia × faixa).';

    if (variacoesState.length > 1) {
      const idents = new Set<string>();
      for (const v of variacoesState) {
        if (!identificadorVariacao(v)) return 'Toda variação precisa de um identificador (ticker, CNPJ ou tipo) quando há mais de uma.';
        // Identidade = identificador + rótulo: duas variações podem compartilhar o mesmo tipo
        // (dois CDBs, por exemplo) desde que o rótulo as diferencie.
        const chave = chaveVariacaoAtivo(v);
        if (idents.has(chave)) return 'Há variações duplicadas. Use o rótulo para diferenciar variações de mesmo tipo.';
        idents.add(chave);
      }
    }

    const combos = new Set<string>();
    for (const c of colocacoes) {
      if (!c.estrategia_id || !c.faixa_id) return 'Toda colocação precisa de estratégia e faixa.';
      const chave = `${c.estrategia_id}|${c.faixa_id}`;
      if (combos.has(chave)) return 'Há colocações duplicadas (mesma estratégia e faixa).';
      combos.add(chave);
    }
    return null;
  };

  const handleSalvar = async () => {
    const msg = validar();
    if (msg) { setErro(msg); return; }
    setSaving(true);
    setErro(null);
    try {
      const compartilhado = {
        nome_ativo: nomeAtivo.trim(),
        origem_ativo: origem,
        asset_classe_nome: classe,
        instituicoes: instituicoes.join(', '),
        observacoes,
      };

      // Salva o produto cartesiano variação × colocação — cada variação recebe exatamente as
      // mesmas colocações (estratégia/faixa/alocação), garantindo que um ajuste afete todas.
      const idsUsados = new Set<string>();
      const operacoes: Promise<any>[] = [];
      for (const v of variacoesState) {
        const identCampos = {
          ticker: origem === 'bolsa' ? v.ticker.trim() : '',
          cnpj: origem === 'fundo' ? v.cnpj.trim() : '',
          tipo: origem === 'bancario' ? v.tipo : '',
          variacoes_fundo: v.variacoes_fundo,
        };
        for (const c of colocacoes) {
          const rowId = idsMap[v.uid]?.[c.uid];
          if (rowId) idsUsados.add(rowId);
          operacoes.push(carteiraRecomendadaService.salvarAtivoRecomendado({
            ...(rowId ? { id: rowId } : {}),
            ...compartilhado,
            ...identCampos,
            estrategia_id: c.estrategia_id,
            faixa_id: c.faixa_id,
            alocacao: Number(c.alocacao) || 0,
          } as any));
        }
      }
      await Promise.all(operacoes);

      // Remove linhas que existiam e cujo par (variação, colocação) foi retirado.
      const idsParaRemover = idsOriginais.filter(id => !idsUsados.has(id));
      if (idsParaRemover.length > 0) await carteiraRecomendadaService.deletarGrupoAtivo(idsParaRemover);

      onSaved();
      onClose();
    } catch (err: any) {
      setErro('Erro ao salvar: ' + (err?.message || 'tente novamente.'));
    } finally { setSaving(false); }
  };

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={grupoInicial ? 'Editar ativo recomendado' : 'Novo ativo recomendado'}
      subtitle="Dados do ativo + variações + colocações por estratégia e faixa"
      widthClass="max-w-xl"
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-colors">Descartar</button>
          <button type="button" onClick={handleSalvar} disabled={saving} className="flex-[2] h-9 rounded-lg bg-[color:var(--primary)] text-[#0b0e14] font-semibold text-[12px] hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
            {saving ? 'Salvando...' : 'Salvar ativo'} <CheckCircle2 size={14} />
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {erro && (
          <div className="flex items-start gap-2 rounded-lg border p-3" style={{ backgroundColor: 'rgba(248,113,113,0.10)', borderColor: 'rgba(248,113,113,0.25)' }}>
            <AlertCircle size={15} className="text-[color:var(--danger)] shrink-0 mt-0.5" />
            <p className="text-[12px] text-[color:var(--danger)] font-medium">{erro}</p>
          </div>
        )}

        {/* Dados compartilhados */}
        <section className="space-y-4">
          <h4 className={fSection}>Dados do ativo</h4>
          <div>
            <label className={fLabel}>Nome do ativo</label>
            <input value={nomeAtivo} onChange={e => setNomeAtivo(e.target.value)} className={fInput} placeholder="Ex.: Tesouro IPCA+ 2029" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={fLabel}>Origem</label>
              <select value={origem} onChange={e => setOrigem(e.target.value as any)} className={fInput}>
                <option value="bolsa">Bolsa (Ticker)</option>
                <option value="fundo">Fundo (CNPJ)</option>
                <option value="bancario">Bancário (Título)</option>
              </select>
            </div>
            <div>
              <label className={fLabel}>Classe de ativo</label>
              <select value={classe} onChange={e => setClasse(e.target.value)} className={fInput}>
                <option value="">Selecione...</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={fLabel}>Instituições habilitadas <span className="text-faint font-normal">(vazio = livre)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {bancos.map(b => {
                const sel = instituicoes.includes(b);
                return (
                  <button key={b} type="button" onClick={() => toggleInstituicao(b)}
                    className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-colors ${sel ? 'bg-[color:var(--primary-soft)] text-[color:var(--primary)] border-[rgba(16,185,129,0.32)]' : 'bg-surface-2 text-faint border-subtle hover:border-strong'}`}>
                    {b}
                  </button>
                );
              })}
              {bancos.length === 0 && <span className="text-[11px] text-faint">Nenhuma instituição cadastrada em Configurações.</span>}
            </div>
          </div>
          <div>
            <label className={fLabel}>Observações <span className="text-faint font-normal">(opcional)</span></label>
            <input value={observacoes} onChange={e => setObservacoes(e.target.value)} className={fInput} />
          </div>
        </section>

        {/* Variações */}
        <section>
          <div className="flex justify-between items-center mb-1">
            <h4 className={`${fSection} flex items-center gap-1.5`}><Layers size={12} /> Variações do ativo</h4>
            <button type="button" onClick={addVariacao} className="flex items-center gap-1 text-[12px] font-semibold text-[color:var(--primary)] hover:underline">
              <Plus size={13} /> Adicionar variação
            </button>
          </div>
          <p className="text-[10px] text-faint mb-3">
            Um mesmo ativo pode ter tickers/CNPJs diferentes (classes de acesso institucional, ou opções
            equivalentes como ETFs). Ajustes de alocação, estratégia ou faixa abaixo valem para todas as variações.
          </p>
          <div className="space-y-2">
            {variacoesState.map(v => (
              <div key={v.uid} className="flex flex-col sm:flex-row gap-2 sm:items-end bg-surface-2 border border-subtle rounded-lg p-2.5">
                <div className="flex-1">
                  {origem === 'bolsa' && (<><label className="block text-[10px] font-semibold text-faint mb-1">Ticker</label><input value={v.ticker} onChange={e => updateVariacao(v.uid, { ticker: e.target.value.toUpperCase() })} className="w-full h-9 px-2.5 bg-surface border border-subtle rounded-lg text-[12px] font-semibold text-main outline-none focus:border-primary transition-colors" /></>)}
                  {origem === 'fundo' && (<><label className="block text-[10px] font-semibold text-faint mb-1">CNPJ</label><input value={v.cnpj} onChange={e => updateVariacao(v.uid, { cnpj: formatarCNPJ(e.target.value) })} className="w-full h-9 px-2.5 bg-surface border border-subtle rounded-lg text-[12px] font-semibold text-main outline-none focus:border-primary transition-colors" /></>)}
                  {origem === 'bancario' && (
                    <>
                      <label className="block text-[10px] font-semibold text-faint mb-1">Tipo</label>
                      <select value={v.tipo} onChange={e => updateVariacao(v.uid, { tipo: e.target.value })} className="w-full h-9 px-2.5 bg-surface border border-subtle rounded-lg text-[12px] font-medium text-main outline-none focus:border-primary transition-colors">
                        <option value="">Selecione...</option>
                        <option value="CDB">CDB</option>
                        <option value="Tesouro">Tesouro Direto</option>
                        <option value="Poupança">Poupança</option>
                        <option value="LCI/LCA">LCI/LCA</option>
                        <option value="Outros">Outros</option>
                      </select>
                    </>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-faint mb-1">Rótulo da variação <span className="text-faint font-normal">(opcional)</span></label>
                  <input value={v.variacoes_fundo} onChange={e => updateVariacao(v.uid, { variacoes_fundo: e.target.value })} placeholder="Ex.: classe Advisory" className="w-full h-9 px-2.5 bg-surface border border-subtle rounded-lg text-[12px] font-medium text-main outline-none focus:border-primary transition-colors" />
                </div>
                {variacoesState.length > 1 && (
                  <button type="button" onClick={() => removeVariacao(v.uid)} className="p-1.5 text-faint hover:text-[color:var(--danger)] rounded-lg transition-colors shrink-0 self-end"><Trash2 size={15} /></button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Colocações */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h4 className={fSection}>Colocações (estratégia × faixa)</h4>
            <button type="button" onClick={addColocacao} className="flex items-center gap-1 text-[12px] font-semibold text-[color:var(--primary)] hover:underline">
              <Plus size={13} /> Adicionar colocação
            </button>
          </div>
          <p className="text-[10px] text-faint mb-3">O mesmo ativo pode estar em várias estratégias e faixas — cada colocação tem sua própria alocação alvo, aplicada a todas as variações.</p>
          <div className="space-y-2">
            {colocacoes.map(c => (
              <div key={c.uid} className="flex flex-col sm:flex-row gap-2 sm:items-end bg-surface-2 border border-subtle rounded-lg p-2.5">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-faint mb-1">Estratégia</label>
                  <select value={c.estrategia_id} onChange={e => updateColocacao(c.uid, { estrategia_id: e.target.value, faixa_id: '' })} className="w-full h-9 px-2.5 bg-surface border border-subtle rounded-lg text-[12px] font-medium text-main outline-none focus:border-primary transition-colors">
                    <option value="">Selecione...</option>
                    {estrategias.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-faint mb-1">Faixa</label>
                  <select value={c.faixa_id} onChange={e => updateColocacao(c.uid, { faixa_id: e.target.value })} disabled={!c.estrategia_id} className="w-full h-9 px-2.5 bg-surface border border-subtle rounded-lg text-[12px] font-medium text-main outline-none focus:border-primary transition-colors disabled:opacity-50">
                    <option value="">Selecione...</option>
                    {faixasDaEstrategia(c.estrategia_id).map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <div className="w-full sm:w-24">
                  <label className="block text-[10px] font-semibold text-faint mb-1">Alocação</label>
                  <div className="relative">
                    <input type="number" step="0.1" value={c.alocacao} onChange={e => updateColocacao(c.uid, { alocacao: parseFloat(e.target.value) || 0 })} className="w-full h-9 pl-2.5 pr-6 bg-surface border border-subtle rounded-lg text-[12px] font-semibold text-main text-center outline-none focus:border-primary transition-colors" />
                    <span className="absolute right-2.5 top-2.5 text-[10px] text-faint font-semibold">%</span>
                  </div>
                </div>
                <button type="button" onClick={() => removeColocacao(c.uid)} className="p-1.5 text-faint hover:text-[color:var(--danger)] rounded-lg transition-colors shrink-0 self-end"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </SidePanel>
  );
};

export default AtivoRecomendadoDrawer;
