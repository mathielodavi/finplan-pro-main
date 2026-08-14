
import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, XCircle, ClipboardList, Upload, ShieldCheck, Landmark } from 'lucide-react';
import * as XLSX from 'xlsx';
import { carteiraRecomendadaService, BlocoResolvido, InstituicaoPendente, ResultadoImportacaoCarteira } from '../../services/carteiraRecomendadaService';
import { configService } from '../../services/configuracoesService';
import Button from '../UI/Button';
import { toast } from '../../utils/toast';

interface ImportacaoCarteiraProps {
  onSuccess: () => void;
}

/** Valores especiais do select de relacionamento de instituição. */
const NOVA = '__nova__';
const REMOVER = '';

const EXEMPLO = `{
  "blocos": [
    {
      "estrategia": "Renda",
      "faixa": "Única",
      "ativos": [
        { "nome_ativo": "Tesouro IPCA+ 2029", "asset": "Renda Fixa",
          "origem": "bancario", "tipo": "Tesouro", "alocacao": 15.5 },
        { "nome_ativo": "ETF de renda fixa", "asset": "Renda Fixa",
          "origem": "bolsa", "alocacao": 8,
          "variacoes": [
            { "nome": "ETF IRFM11", "ticker": "IRFM11" },
            { "nome": "ETF IDKA11", "ticker": "IDKA11" }
          ] }
      ]
    }
  ]
}`;

const ImportacaoCarteira: React.FC<ImportacaoCarteiraProps> = ({ onSuccess }) => {
  const [texto, setTexto] = useState('');
  const [preview, setPreview] = useState<BlocoResolvido[] | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [alertas, setAlertas] = useState<string[]>([]);
  const [instituicoes, setInstituicoes] = useState<InstituicaoPendente[]>([]);
  const [mapaInst, setMapaInst] = useState<Record<string, string>>({});
  const [bancos, setBancos] = useState<string[]>([]);
  const [analisando, setAnalisando] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacaoCarteira | null>(null);

  const limparPreview = (novoTexto: string) => {
    setTexto(novoTexto);
    if (preview || erros.length) { setPreview(null); setErros([]); setAlertas([]); setInstituicoes([]); setMapaInst({}); }
  };

  const analisar = async () => {
    setAnalisando(true);
    try {
      const { blocos, erros: errosParse } = carteiraRecomendadaService.parseBlocosJSON(texto);
      if (errosParse.length > 0) { setErros(errosParse); setPreview(null); return; }

      const [resolucao, listaBancos] = await Promise.all([
        carteiraRecomendadaService.resolverBlocos(blocos),
        configService.getBancos(),
      ]);
      setErros(resolucao.erros);
      setAlertas(resolucao.alertas);
      setBancos((listaBancos || []).map((b: any) => b.nome));
      setInstituicoes(resolucao.instituicoes);
      // Pré-seleciona a sugestão do sistema; sem sugestão, propõe cadastrar (preserva o dado).
      setMapaInst(Object.fromEntries(resolucao.instituicoes.map(i => [i.nome, i.sugestao ?? NOVA])));
      setPreview(resolucao.erros.length > 0 ? null : resolucao.blocos);
    } catch (err: any) {
      toast.error('Erro ao analisar: ' + (err?.message || 'tente novamente.'));
    } finally {
      setAnalisando(false);
    }
  };

  const importar = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      // 1. Cadastra as instituições marcadas como novas.
      const novas = instituicoes.filter(i => mapaInst[i.nome] === NOVA);
      // `tipo` é NOT NULL em bancos_corretoras; 'corretora' é o default do cadastro manual
      // (FormBanco em InvestimentosConfig.tsx) e o caso mais comum para ativos recomendados.
      for (const n of novas) await configService.saveBanco({ nome: n.nome, tipo: 'corretora' });

      // 2. "Nova" mantém o próprio nome; as demais viram o banco escolhido (ou saem, se vazio).
      const mapaFinal: Record<string, string> = {};
      Object.entries(mapaInst).forEach(([origem, destino]) => {
        mapaFinal[origem] = destino === NOVA ? origem : destino;
      });

      const blocos = carteiraRecomendadaService.aplicarMapaInstituicoes(preview, mapaFinal);
      const res = await carteiraRecomendadaService.aplicarBlocos(blocos, alertas);
      setResultado(res);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao importar.');
    } finally {
      setLoading(false);
    }
  };

  // Planilha (fluxo antigo, mantido): lê o arquivo e delega ao mesmo núcleo escopado.
  const importarPlanilha = async (file: File) => {
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      const res = await carteiraRecomendadaService.importarCarteira(rows);
      setResultado(res);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao ler a planilha. Verifique as colunas.');
    } finally {
      setLoading(false);
    }
  };

  if (resultado) {
    const totalInseridos = resultado.blocos.reduce((a, b) => a + b.inseridos, 0);
    return (
      <div className="space-y-6 animate-slide-up">
        <div className="text-center space-y-3">
          <div className="h-14 w-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={28} />
          </div>
          <h3 className="text-[18px] font-bold text-main">Importação concluída</h3>
          <p className="text-[13px] text-muted">{totalInseridos} linha(s) em {resultado.blocos.length} combinação(ões)</p>
        </div>

        <div className="rounded-xl border border-subtle divide-y divide-subtle overflow-hidden">
          {resultado.blocos.map((b, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-main truncate">{b.estrategia}</p>
                <p className="text-[11px] text-faint truncate">{b.faixa}</p>
              </div>
              <span className="text-[12px] text-muted shrink-0">
                <b className="text-main">{b.inseridos}</b> nova(s) · {b.removidos} substituída(s)
              </span>
            </div>
          ))}
        </div>

        <Button onClick={onSuccess} className="w-full h-10 text-[12px] rounded-lg font-semibold">Ver carteira</Button>
      </div>
    );
  }

  const totalAtivos = preview?.reduce((a, b) => a + b.ativos, 0) || 0;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="p-3.5 rounded-xl border border-subtle flex items-start gap-3" style={{ backgroundColor: 'var(--primary-soft)' }}>
        <ShieldCheck className="text-primary shrink-0" size={18} />
        <p className="text-[12px] text-main leading-snug">
          Só as combinações de <b>estratégia × faixa</b> presentes no arquivo são substituídas.
          As demais permanecem intactas.
        </p>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-faint uppercase tracking-wider mb-1.5">Colar dados (JSON)</label>
        <textarea
          value={texto}
          onChange={e => limparPreview(e.target.value)}
          placeholder={EXEMPLO}
          spellCheck={false}
          className="w-full h-44 bg-surface-2 border border-subtle rounded-lg px-3 py-2.5 text-main text-[12px] font-mono leading-relaxed outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-y placeholder:text-faint"
        />
      </div>

      {erros.length > 0 && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 space-y-1.5">
          <p className="flex items-center gap-2 text-[11px] font-bold text-danger uppercase tracking-wider">
            <XCircle size={13} /> Nada foi gravado ({erros.length})
          </p>
          {erros.slice(0, 8).map((e, i) => (
            <p key={i} className="text-[12px] text-danger font-medium leading-relaxed">{e}</p>
          ))}
          {erros.length > 8 && <p className="text-[11px] text-danger/80">…e mais {erros.length - 8}.</p>}
        </div>
      )}

      {!preview ? (
        <>
          <Button
            onClick={analisar}
            disabled={!texto.trim() || analisando}
            isLoading={analisando}
            leftIcon={<ClipboardList size={15} />}
            className="w-full h-10 text-[12px] rounded-lg font-semibold"
          >
            Analisar dados
          </Button>

          <div className="pt-2 border-t border-subtle">
            <input type="file" id="up-carteira" className="hidden" accept=".xlsx,.csv"
              onChange={e => { if (e.target.files?.[0]) importarPlanilha(e.target.files[0]); }} />
            <label htmlFor="up-carteira" className="flex items-center justify-center gap-2 h-9 rounded-lg border border-subtle text-muted text-[12px] font-semibold hover:bg-surface-2 transition-colors cursor-pointer">
              <Upload size={14} /> {loading ? 'Processando planilha...' : 'Ou importar planilha (XLSX/CSV)'}
            </label>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-xl border border-subtle divide-y divide-subtle overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
            {preview.map((b, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 gap-2">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-main truncate">{b.estrategia}</p>
                  <p className="text-[11px] text-faint truncate">{b.faixa}</p>
                </div>
                <span className="text-[12px] text-muted shrink-0">
                  <b className="text-main">{b.ativos}</b> ativo(s)
                  {b.linhas.length !== b.ativos && <> · {b.linhas.length} linhas</>}
                  {b.substituira > 0 && <> · substitui {b.substituira}</>}
                </span>
              </div>
            ))}
          </div>

          {instituicoes.length > 0 && (
            <div className="rounded-xl border border-subtle overflow-hidden">
              <div className="px-3 py-2 bg-[color:var(--warning)]/15 flex items-center gap-2 border-b border-subtle">
                <Landmark size={14} className="text-[color:var(--warning)]" />
                <span className="text-[11px] font-bold text-[color:var(--warning)] uppercase tracking-wider">
                  Relacionar instituições ({instituicoes.length})
                </span>
              </div>
              <p className="px-3 pt-2.5 text-[11px] text-muted leading-relaxed">
                Estes nomes não batem com nenhuma instituição cadastrada. Sem relacionar, o ativo
                deixa de aparecer no Simulador Tático para clientes dessa corretora.
              </p>
              <div className="p-3 space-y-2.5 max-h-56 overflow-y-auto custom-scrollbar">
                {instituicoes.map(inst => (
                  <div key={inst.nome} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12px] font-semibold text-main truncate">{inst.nome}</span>
                      <span className="text-[10.5px] text-faint shrink-0">{inst.ocorrencias} linha(s)</span>
                    </div>
                    <select
                      value={mapaInst[inst.nome] ?? NOVA}
                      onChange={e => setMapaInst(m => ({ ...m, [inst.nome]: e.target.value }))}
                      className="w-full h-9 px-2.5 bg-surface-2 border border-subtle rounded-lg text-[12px] font-medium text-main outline-none focus:border-primary transition-colors"
                    >
                      <option value={NOVA}>Cadastrar "{inst.nome}" como nova</option>
                      {bancos.map(b => (
                        <option key={b} value={b}>
                          Relacionar a: {b}{inst.sugestao === b ? '  (sugerido)' : ''}
                        </option>
                      ))}
                      <option value={REMOVER}>Remover — ativo vale para qualquer instituição</option>
                    </select>
                    {inst.sugestao && mapaInst[inst.nome] === inst.sugestao && (
                      <p className="text-[10.5px] text-primary">Sugerido pelo sistema ({Math.round(inst.score * 100)}% de semelhança).</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {alertas.length > 0 && (
            <div className="rounded-lg border border-subtle bg-surface-2 px-3 py-2.5 space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-[color:var(--warning)] uppercase tracking-wider">
                <AlertCircle size={12} /> Avisos ({alertas.length})
              </p>
              {alertas.slice(0, 5).map((a, i) => <p key={i} className="text-[11.5px] text-muted leading-relaxed">{a}</p>)}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPreview(null)} disabled={loading} className="h-10 px-4 text-[12px] rounded-lg font-semibold">Voltar</Button>
            <Button onClick={importar} isLoading={loading} className="flex-1 h-10 text-[12px] rounded-lg font-semibold">
              Importar {totalAtivos} ativo(s)
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default ImportacaoCarteira;
