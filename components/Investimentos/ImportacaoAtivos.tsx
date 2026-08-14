import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Plus, RefreshCw, ClipboardList } from 'lucide-react';
import { importacaoService, PreviewLinha, PayloadImportacao, ResultadoImportacao } from '../../services/importacaoService';
import { investimentoService } from '../../services/investimentoService';
import { formatarMoeda } from '../../utils/formatadores';
import { toast } from '../../utils/toast';

interface ImportacaoAtivosProps {
  clienteId: string;
  onSuccess: () => void;
}

const EXEMPLO = `{
  "aporte_periodo": 0,
  "ativos": [
    { "nome": "PETR4", "ticker": "PETR4", "origem": "bolsa", "tipo_ativo": "Ações", "valor_atual": 8750.00 },
    { "nome": "Tesouro Selic 2029", "origem": "bancario", "tipo_ativo": "Renda Fixa", "valor_atual": 15230.44 }
  ]
}`;

const ImportacaoAtivos: React.FC<ImportacaoAtivosProps> = ({ clienteId, onSuccess }) => {
  const [texto, setTexto] = useState('');
  const [aporte, setAporte] = useState(0);
  const [preview, setPreview] = useState<PreviewLinha[] | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [payload, setPayload] = useState<PayloadImportacao | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);

  const resetPreview = (novoTexto: string) => {
    setTexto(novoTexto);
    if (preview) { setPreview(null); setPayload(null); setErros([]); }
  };

  const analisar = async () => {
    setAnalisando(true);
    try {
      const { payload: p, erros: e } = importacaoService.parsePayload(texto);
      setErros(e);
      if (e.length > 0 || p.ativos.length === 0) { setPreview(null); setPayload(null); return; }
      setAporte(prev => (prev !== 0 ? prev : (p.aporte_periodo || 0)));
      const existentes = (await investimentoService.getAtivos(clienteId)) || [];
      setPreview(importacaoService.classificar(existentes, p.ativos));
      setPayload(p);
    } catch {
      toast.error('Erro ao analisar os dados.');
    } finally {
      setAnalisando(false);
    }
  };

  const importar = async () => {
    if (!payload) return;
    setLoading(true);
    try {
      const res = await importacaoService.importarAtivosJSON(clienteId, { ...payload, aporte_periodo: aporte });
      setResultado(res);
      setTimeout(() => onSuccess(), 1800);
    } catch (err: any) {
      toast.error('Erro ao importar: ' + (err?.message || 'tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  if (resultado) {
    return (
      <div className="py-10 text-center space-y-4 animate-fade-in">
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto" style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}>
          <CheckCircle2 size={32} strokeWidth={2.5} />
        </div>
        <h3 className="text-[18px] font-bold text-main">Carteira sincronizada</h3>
        <p className="text-[13px] text-muted">
          {resultado.inseridos} ativo(s) inserido(s) · {resultado.atualizados} ajustado(s).<br />
          Patrimônio total: <span className="font-bold text-main">{formatarMoeda(resultado.totalCarteira)}</span>
        </p>
      </div>
    );
  }

  const novos = preview?.filter(p => p.acao === 'inserir').length || 0;
  const ajustes = preview?.filter(p => p.acao === 'ajustar').length || 0;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] font-bold text-faint uppercase tracking-wider mb-1.5">Colar dados (JSON)</label>
        <textarea
          value={texto}
          onChange={e => resetPreview(e.target.value)}
          placeholder={EXEMPLO}
          spellCheck={false}
          className="w-full h-40 bg-surface-2 border border-subtle rounded-lg px-3 py-2.5 text-main text-[12px] font-mono leading-relaxed outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-y placeholder:text-faint"
        />
        <p className="text-[11px] text-faint mt-1.5">
          Cole o JSON exportado pela skill. Casa por ticker → CNPJ → nome; ativo existente tem o saldo <b>sobrescrito</b>, novo é criado com destino 100% independência.
        </p>
      </div>

      {erros.length > 0 && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 space-y-1">
          {erros.slice(0, 6).map((e, i) => (
            <p key={i} className="flex items-start gap-2 text-[12px] text-danger font-medium"><AlertCircle size={13} className="shrink-0 mt-0.5" /> {e}</p>
          ))}
        </div>
      )}

      {!preview ? (
        <button
          onClick={analisar}
          disabled={!texto.trim() || analisando}
          className="w-full h-10 rounded-lg font-semibold text-[12px] text-[#0b0e14] bg-primary hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <ClipboardList size={15} /> {analisando ? 'Analisando...' : 'Analisar dados'}
        </button>
      ) : (
        <>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="inline-flex items-center gap-1 font-semibold text-primary"><Plus size={13} /> {novos} novo(s)</span>
            <span className="text-faint">·</span>
            <span className="inline-flex items-center gap-1 font-semibold text-[color:var(--warning)]"><RefreshCw size={13} /> {ajustes} ajuste(s)</span>
          </div>

          <div className="rounded-lg border border-subtle divide-y divide-subtle max-h-64 overflow-y-auto custom-scrollbar">
            {preview.map((p, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 gap-2">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-main truncate">{p.row.nome}</p>
                  <p className="text-[10.5px] text-faint truncate">{p.row.ticker || p.row.cnpj || p.row.tipo_ativo || '—'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.acao === 'ajustar' && (
                    <span className="text-[11px] text-faint line-through">{formatarMoeda(p.valorAnterior || 0)}</span>
                  )}
                  <span className="text-[12.5px] font-bold text-main">{formatarMoeda(p.row.valor_atual)}</span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${p.acao === 'inserir' ? 'text-primary bg-primary/10' : 'text-[color:var(--warning)] bg-[color:var(--warning)]/10'}`}>
                    {p.acao === 'inserir' ? 'Novo' : 'Ajuste'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-faint uppercase tracking-wider mb-1.5">Aporte líquido do período (opcional)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-faint">R$</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={aporte || ''}
                onChange={e => setAporte(parseFloat(e.target.value) || 0)}
                placeholder="0,00"
                className="w-full h-9 pl-9 pr-3 bg-surface-2 border border-subtle rounded-lg text-main text-[12px] font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <p className="text-[11px] text-faint mt-1.5">Dinheiro novo aportado desde a última sincronização. Registrado no histórico para não superestimar a rentabilidade (o restante da variação vira retorno).</p>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setPreview(null); setPayload(null); }}
              disabled={loading}
              className="h-10 px-4 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-colors disabled:opacity-50"
            >
              Voltar
            </button>
            <button
              onClick={importar}
              disabled={loading}
              className="flex-1 h-10 rounded-lg font-semibold text-[12px] text-[#0b0e14] bg-primary hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Importando...' : `Importar ${preview.length} ativo(s)`}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ImportacaoAtivos;
