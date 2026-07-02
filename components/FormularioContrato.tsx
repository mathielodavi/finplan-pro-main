
import React, { useState, useEffect, useCallback } from 'react';
import { Contrato, ContratoTipo, ContratoStatus } from '../types/contrato';
import { validarContrato } from '../utils/validadores';
import { configService } from '../services/configuracoesService';
import Button from './UI/Button';
import CampoMoeda from './UI/CampoMoeda';
import CampoPercentual from './UI/CampoPercentual';

interface FormularioContratoProps {
  clienteId: string;
  contratoInicial?: Contrato | null;
  onSuccess: (dados: Partial<Contrato>) => Promise<void>;
  onCancel: () => void;
}

const FormularioContrato: React.FC<FormularioContratoProps> = ({ clienteId, contratoInicial, onSuccess, onCancel }) => {
  // Tipo e status
  const [tipo, setTipo] = useState<ContratoTipo>(contratoInicial?.tipo || 'planejamento');
  const [status, setStatus] = useState<ContratoStatus>(contratoInicial?.status || 'ativo');
  const [dataCancelamento, setDataCancelamento] = useState(
    contratoInicial?.status === 'cancelado' ? (contratoInicial?.data_fim || '') : new Date().toISOString().split('T')[0]
  );

  // Padrões de contrato (carregados do Supabase)
  const [padroes, setPadroes] = useState<any[]>([]);
  const [padraoSelecionadoId, setPadraoSelecionadoId] = useState<string>(contratoInicial?.padrao_id || '');
  const [loadingPadroes, setLoadingPadroes] = useState(false);

  // Campos do contrato
  const [descricao, setDescricao] = useState(contratoInicial?.descricao || '');
  const [ticketMensal, setTicketMensal] = useState('0');
  const [prazoMeses, setPrazoMeses] = useState(contratoInicial?.prazo_meses?.toString() || '12');
  const [valorTotal, setValorTotal] = useState(contratoInicial?.valor?.toString() || '0');
  const [formaPagamento, setFormaPagamento] = useState<'vista' | 'parcelado'>(
    (contratoInicial?.forma_pagamento as 'vista' | 'parcelado') || 'parcelado'
  );
  const [repassePercentual, setRepassePercentual] = useState(
    contratoInicial?.repasse_percentual?.toString() || '100'
  );
  const [prazoRecebimento, setPrazoRecebimento] = useState(
    contratoInicial?.prazo_recebimento_dias?.toString() || '30'
  );
  const [dataInicio, setDataInicio] = useState(contratoInicial?.data_inicio || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Carregar padrões ao mudar tipo ────────────────────────────
  useEffect(() => {
    const carregarPadroes = async () => {
      setLoadingPadroes(true);
      setPadraoSelecionadoId('');
      try {
        const lista = tipo === 'planejamento'
          ? await configService.getPlanejamento()
          : await configService.getExtras();
        setPadroes(lista || []);
      } catch {
        setPadroes([]);
      } finally {
        setLoadingPadroes(false);
      }
    };
    carregarPadroes();
  }, [tipo]);

  // ─── Auto-preenchimento ao selecionar padrão ─────────────────
  useEffect(() => {
    if (!padraoSelecionadoId) return;
    const padrao = padroes.find(p => p.id === padraoSelecionadoId);
    if (!padrao) return;

    if (tipo === 'planejamento') {
      const ticket = padrao.valor || 0;
      const prazo = padrao.prazo_meses || 12;
      setTicketMensal(ticket.toString());
      setPrazoMeses(prazo.toString());
      setValorTotal((ticket * prazo).toString());
      setRepassePercentual((padrao.repasse_percentual ?? 100).toString());
      setPrazoRecebimento((padrao.prazo_recebimento_dias ?? 30).toString());
    } else {
      // Extra: valor do first fase ou campo valor
      const valorExtra = padrao.valor || 0;
      setTicketMensal(valorExtra.toString());
      setValorTotal(valorExtra.toString());
    }
  }, [padraoSelecionadoId, padroes, tipo]);

  // ─── Recalcular valor total quando ticket ou prazo mudam ──────
  useEffect(() => {
    if (tipo === 'planejamento') {
      const ticket = parseFloat(ticketMensal) || 0;
      const prazo = parseInt(prazoMeses) || 1;
      setValorTotal((ticket * prazo).toString());
    }
  }, [ticketMensal, prazoMeses, tipo, formaPagamento]);

  // ─── Submit ──────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numValor = parseFloat(valorTotal);
    const validacao = validarContrato({ tipo, valor: numValor, data_inicio: dataInicio });
    if (!validacao.valido) return setError(validacao.erros[0]);

    let dataFim = status === 'cancelado' ? dataCancelamento : null;
    if (status !== 'cancelado' && dataInicio && prazoMeses) {
      const [y, m, d] = dataInicio.split('-').map(Number);
      const dtInicio = new Date(y, m - 1, d);
      dtInicio.setMonth(dtInicio.getMonth() + (parseInt(prazoMeses) || 12));
      dataFim = dtInicio.toISOString().split('T')[0];
    }

    try {
      setLoading(true);
      await onSuccess({
        id: contratoInicial?.id,
        cliente_id: clienteId,
        tipo,
        descricao,
        valor: numValor,
        data_inicio: dataInicio,
        status,
        data_fim: dataFim,
        forma_pagamento: formaPagamento,
        prazo_meses: parseInt(prazoMeses) || 12,
        repasse_percentual: parseFloat(repassePercentual) || 100,
        prazo_recebimento_dias: parseInt(prazoRecebimento) || 30,
        padrao_id: padraoSelecionadoId || null,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = "w-full px-4 py-2.5 bg-surface-2 border border-subtle rounded-xl font-bold text-main outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-600 transition-all text-xs";
  const labelStyle = "block text-[9px] font-black text-faint ml-1 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Tipo + Status */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelStyle}>Tipo de Contrato</label>
          <select value={tipo} onChange={e => setTipo(e.target.value as ContratoTipo)} className={inputStyle}>
            <option value="planejamento">Planejamento</option>
            <option value="extra">Extra</option>
          </select>
        </div>
        <div>
          <label className={labelStyle}>Status</label>
          <select
            value={status}
            onChange={e => {
              const newStatus = e.target.value as ContratoStatus;
              setStatus(newStatus);
              if (newStatus === 'cancelado' && !dataCancelamento) {
                setDataCancelamento(new Date().toISOString().split('T')[0]);
              }
            }}
            className={inputStyle}
          >
            <option value="ativo">Ativo</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </div>

      {status === 'cancelado' && (
        <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100/50 my-4">
          <label className={`${labelStyle} !text-rose-500`}>Data Efetiva de Cancelamento</label>
          <input
            type="date"
            required
            value={dataCancelamento}
            onChange={e => setDataCancelamento(e.target.value)}
            className={`${inputStyle} font-black border-rose-200 focus:border-rose-500 focus:ring-rose-500/10 text-rose-700 bg-surface`}
          />
          <p className="text-[10px] text-rose-400 font-bold mt-2 ml-1">O motor de encerramento blindará parcelas passadas. Apenas as projeções após D+{(parseInt(prazoRecebimento) || 0)} desta data serão removidas.</p>
        </div>
      )}

      {/* Padrão de Contrato */}
      <div>
        <label className={labelStyle}>
          Padrão de Contrato — <span className="text-emerald-500 normal-case">{loadingPadroes ? 'Carregando...' : `${padroes.length} disponíveis`}</span>
        </label>
        <select
          value={padraoSelecionadoId}
          onChange={e => setPadraoSelecionadoId(e.target.value)}
          className={inputStyle}
          disabled={loadingPadroes}
        >
          <option value="">— Selecionar padrão (auto-preenche campos) —</option>
          {padroes.map(p => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
        {padroes.length === 0 && !loadingPadroes && (
          <p className="text-[10px] text-amber-500 font-bold ml-1 mt-1">
            Nenhum padrão cadastrado. Configure em Configurações → Contratos.
          </p>
        )}
      </div>

      {/* Descrição */}
      <div>
        <label className={labelStyle}>Descrição / Observações</label>
        <textarea
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
          className={`${inputStyle} h-20 resize-none`}
          placeholder="Ex: Planejamento financeiro completo — Família Silva..."
        />
      </div>

      {/* Ticket + Prazo (só planejamento) */}
      {tipo === 'planejamento' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelStyle}>Ticket Mensal</label>
            <CampoMoeda value={parseFloat(ticketMensal) || 0} onChange={n => setTicketMensal(String(n))} className={inputStyle} />
          </div>
          <div>
            <label className={labelStyle}>Prazo (meses)</label>
            <input
              type="number"
              min="1"
              value={prazoMeses}
              onChange={e => setPrazoMeses(e.target.value)}
              className={inputStyle}
              placeholder="12"
            />
          </div>
        </div>
      )}

      {/* Valor Total */}
      <div>
        <label className={labelStyle}>
          Valor Total do Contrato
          {tipo === 'planejamento' && (
            <span className="text-faint normal-case font-medium ml-1">(calculado automaticamente)</span>
          )}
        </label>
        <CampoMoeda
          value={parseFloat(valorTotal) || 0}
          onChange={n => setValorTotal(String(n))}
          disabled={tipo === 'planejamento'}
          className={`${inputStyle} ${tipo === 'planejamento' ? 'bg-surface-2 text-faint' : ''}`}
        />
      </div>

      {/* Forma de Pagamento + Data Início */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelStyle}>Forma de Pagamento</label>
          <div className="flex bg-surface-2 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFormaPagamento('vista')}
              className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${formaPagamento === 'vista' ? 'bg-surface text-emerald-600 shadow-sm' : 'text-faint hover:text-muted'}`}
            >
              À Vista
            </button>
            <button
              type="button"
              onClick={() => setFormaPagamento('parcelado')}
              className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${formaPagamento === 'parcelado' ? 'bg-surface text-emerald-600 shadow-sm' : 'text-faint hover:text-muted'}`}
            >
              Parcelado
            </button>
          </div>
        </div>
        <div>
          <label className={labelStyle}>Data de Início</label>
          <input
            type="date"
            value={dataInicio}
            onChange={e => setDataInicio(e.target.value)}
            className={inputStyle}
            required
          />
        </div>
      </div>

      {/* Repasse + Prazo Recebimento */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelStyle}>Repasse ao Consultor (%)</label>
          <CampoPercentual value={parseFloat(repassePercentual) || 0} onChange={n => setRepassePercentual(String(n))} className={inputStyle} />
        </div>
        <div>
          <label className={labelStyle}>Prazo de Recebimento (dias)</label>
          <input
            type="number"
            min="0"
            value={prazoRecebimento}
            onChange={e => setPrazoRecebimento(e.target.value)}
            className={inputStyle}
            placeholder="30"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 text-rose-600 text-xs font-bold rounded-2xl border-2 border-rose-100">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel} className="flex-1 text-xs">
          Cancelar
        </Button>
        <Button variant="primary" type="submit" isLoading={loading} className="flex-1 text-xs">
          Salvar Contrato
        </Button>
      </div>
    </form>
  );
};

export default FormularioContrato;
