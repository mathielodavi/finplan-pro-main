import React, { useState, useEffect, useMemo } from 'react';
import { carteiraRecomendadaService, AtivoRecomendado } from '../../services/carteiraRecomendadaService';
import { configService } from '../../services/configuracoesService';
import { formatarCNPJ } from '../../utils/formatadores';
import SidePanel from '../UI/SidePanel';
import { Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

/** Colocação = uma linha (estratégia × faixa × ativo) com sua própria alocação. */
interface Colocacao {
  id?: string;
  estrategia_id: string;
  faixa_id: string;
  alocacao: number;
}

/** Grupo de um ativo = seus dados compartilhados + a lista de colocações (linhas do banco). */
export interface GrupoAtivo {
  nome_ativo: string;
  origem_ativo: 'bolsa' | 'fundo' | 'bancario';
  ticker?: string;
  cnpj?: string;
  tipo?: string;
  asset_classe_nome: string;
  instituicoes?: string;
  variacoes_fundo?: string;
  observacoes?: string;
  colocacoes: AtivoRecomendado[];
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

const AtivoRecomendadoDrawer: React.FC<Props> = ({ open, onClose, grupoInicial, onSaved }) => {
  const [estrategias, setEstrategias] = useState<any[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [bancos, setBancos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Estado compartilhado do ativo
  const [nomeAtivo, setNomeAtivo] = useState('');
  const [origem, setOrigem] = useState<'bolsa' | 'fundo' | 'bancario'>('bolsa');
  const [ticker, setTicker] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [tipo, setTipo] = useState('');
  const [classe, setClasse] = useState('');
  const [instituicoes, setInstituicoes] = useState<string[]>([]);
  const [variacoes, setVariacoes] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const [colocacoes, setColocacoes] = useState<Colocacao[]>([]);
  // Ids das colocações originais — para saber quais remover no banco ao salvar.
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

  // Semeia o formulário a partir do grupo em edição (ou zera para novo).
  useEffect(() => {
    if (!open) return;
    if (grupoInicial) {
      setNomeAtivo(grupoInicial.nome_ativo || '');
      setOrigem((grupoInicial.origem_ativo as any) || 'bolsa');
      setTicker(grupoInicial.ticker || '');
      setCnpj(grupoInicial.cnpj || '');
      setTipo(grupoInicial.tipo || '');
      setClasse(grupoInicial.asset_classe_nome || '');
      setInstituicoes((grupoInicial.instituicoes || '').split(',').map(s => s.trim()).filter(Boolean));
      setVariacoes(grupoInicial.variacoes_fundo || '');
      setObservacoes(grupoInicial.observacoes || '');
      const cols = (grupoInicial.colocacoes || []).map(c => ({ id: c.id, estrategia_id: c.estrategia_id, faixa_id: c.faixa_id, alocacao: Number(c.alocacao) || 0 }));
      setColocacoes(cols);
      setIdsOriginais(cols.map(c => c.id!).filter(Boolean));
    } else {
      setNomeAtivo(''); setOrigem('bolsa'); setTicker(''); setCnpj(''); setTipo('');
      setClasse(''); setInstituicoes([]); setVariacoes(''); setObservacoes('');
      setColocacoes([{ estrategia_id: '', faixa_id: '', alocacao: 0 }]);
      setIdsOriginais([]);
    }
    setErro(null);
  }, [open, grupoInicial]);

  const faixasDaEstrategia = (estrategiaId: string) => estrategias.find(e => e.id === estrategiaId)?.faixas || [];

  const addColocacao = () => setColocacoes(prev => [...prev, { estrategia_id: '', faixa_id: '', alocacao: 0 }]);
  const removeColocacao = (idx: number) => setColocacoes(prev => prev.filter((_, i) => i !== idx));
  const updateColocacao = (idx: number, patch: Partial<Colocacao>) => setColocacoes(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));

  const toggleInstituicao = (nome: string) => setInstituicoes(prev => prev.includes(nome) ? prev.filter(n => n !== nome) : [...prev, nome]);

  const validar = (): string | null => {
    if (!nomeAtivo.trim()) return 'Informe o nome do ativo.';
    if (!classe) return 'Selecione a classe de ativo.';
    if (colocacoes.length === 0) return 'Adicione ao menos uma colocação (estratégia × faixa).';
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
        ticker: origem === 'bolsa' ? ticker.trim() : '',
        cnpj: (origem === 'fundo') ? cnpj.trim() : '',
        tipo: origem === 'bancario' ? tipo : '',
        asset_classe_nome: classe,
        instituicoes: instituicoes.join(', '),
        variacoes_fundo: variacoes,
        observacoes,
      };
      // Upsert de cada colocação (propaga os dados compartilhados a todas as linhas do ativo).
      for (const c of colocacoes) {
        await carteiraRecomendadaService.salvarAtivoRecomendado({
          ...(c.id ? { id: c.id } : {}),
          ...compartilhado,
          estrategia_id: c.estrategia_id,
          faixa_id: c.faixa_id,
          alocacao: Number(c.alocacao) || 0,
        } as any);
      }
      // Remove colocações que existiam e foram tiradas.
      const idsAtuais = new Set(colocacoes.map(c => c.id).filter(Boolean));
      for (const idOrig of idsOriginais) {
        if (!idsAtuais.has(idOrig)) await carteiraRecomendadaService.deletarAtivoRecomendado(idOrig);
      }
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
      subtitle="Dados do ativo + colocações por estratégia e faixa"
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
              <select value={origem} onChange={e => { setOrigem(e.target.value as any); setTicker(''); setCnpj(''); setTipo(''); }} className={fInput}>
                <option value="bolsa">Bolsa (Ticker)</option>
                <option value="fundo">Fundo (CNPJ)</option>
                <option value="bancario">Bancário (Título)</option>
              </select>
            </div>
            <div>
              {origem === 'bolsa' && <><label className={fLabel}>Ticker</label><input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} className={fInput} /></>}
              {origem === 'fundo' && <><label className={fLabel}>CNPJ</label><input value={cnpj} onChange={e => setCnpj(formatarCNPJ(e.target.value))} className={fInput} /></>}
              {origem === 'bancario' && <><label className={fLabel}>Tipo</label><select value={tipo} onChange={e => setTipo(e.target.value)} className={fInput}><option value="">Selecione...</option><option value="CDB">CDB</option><option value="Tesouro">Tesouro Direto</option><option value="Poupança">Poupança</option><option value="LCI/LCA">LCI/LCA</option><option value="Outros">Outros</option></select></>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={fLabel}>Classe de ativo</label>
              <select value={classe} onChange={e => setClasse(e.target.value)} className={fInput}>
                <option value="">Selecione...</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={fLabel}>Variações do fundo <span className="text-faint font-normal">(opcional)</span></label>
              <input value={variacoes} onChange={e => setVariacoes(e.target.value)} className={fInput} />
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

        {/* Colocações */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h4 className={fSection}>Colocações (estratégia × faixa)</h4>
            <button type="button" onClick={addColocacao} className="flex items-center gap-1 text-[12px] font-semibold text-[color:var(--primary)] hover:underline">
              <Plus size={13} /> Adicionar colocação
            </button>
          </div>
          <p className="text-[10px] text-faint mb-3">O mesmo ativo pode estar em várias estratégias e faixas — cada colocação tem sua própria alocação alvo.</p>
          <div className="space-y-2">
            {colocacoes.map((c, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:items-end bg-surface-2 border border-subtle rounded-lg p-2.5">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-faint mb-1">Estratégia</label>
                  <select value={c.estrategia_id} onChange={e => updateColocacao(idx, { estrategia_id: e.target.value, faixa_id: '' })} className="w-full h-9 px-2.5 bg-surface border border-subtle rounded-lg text-[12px] font-medium text-main outline-none focus:border-primary transition-colors">
                    <option value="">Selecione...</option>
                    {estrategias.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-faint mb-1">Faixa</label>
                  <select value={c.faixa_id} onChange={e => updateColocacao(idx, { faixa_id: e.target.value })} disabled={!c.estrategia_id} className="w-full h-9 px-2.5 bg-surface border border-subtle rounded-lg text-[12px] font-medium text-main outline-none focus:border-primary transition-colors disabled:opacity-50">
                    <option value="">Selecione...</option>
                    {faixasDaEstrategia(c.estrategia_id).map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <div className="w-full sm:w-24">
                  <label className="block text-[10px] font-semibold text-faint mb-1">Alocação</label>
                  <div className="relative">
                    <input type="number" step="0.1" value={c.alocacao} onChange={e => updateColocacao(idx, { alocacao: parseFloat(e.target.value) || 0 })} className="w-full h-9 pl-2.5 pr-6 bg-surface border border-subtle rounded-lg text-[12px] font-semibold text-main text-center outline-none focus:border-primary transition-colors" />
                    <span className="absolute right-2.5 top-2.5 text-[10px] text-faint font-semibold">%</span>
                  </div>
                </div>
                <button type="button" onClick={() => removeColocacao(idx)} className="p-1.5 text-faint hover:text-[color:var(--danger)] rounded-lg transition-colors shrink-0 self-end"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </SidePanel>
  );
};

export default AtivoRecomendadoDrawer;
