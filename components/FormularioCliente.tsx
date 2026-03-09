import React, { useState, useEffect } from 'react';
import { Cliente, criarCliente, atualizarCliente } from '../services/clienteService';
import Button from './UI/Button';

interface FormularioClienteProps {
  clienteInicial?: Cliente | null;
  onSuccess: () => void;
  onCancel: () => void;
}

// Opções de origem — lista padrão (pode ser expandida futuramente via configurações)
const ORIGENS_PADRAO = [
  'Indicação de cliente',
  'Indicação profissional',
  'Redes sociais',
  'Site / Blog',
  'Evento / Palestra',
  'Prospecção ativa',
  'Parceria comercial',
  'Outro',
];

const ETAPAS = [
  'Prospecção',
  'Apresentação',
  'Análise',
  'Implementação',
  'Acompanhamento',
];

const FormularioCliente: React.FC<FormularioClienteProps> = ({ clienteInicial, onSuccess, onCancel }) => {
  const [nome, setNome] = useState('');
  const [patrimonio, setPatrimonio] = useState('0');
  const [aporte, setAporte] = useState('0');
  const [status, setStatus] = useState('Ativo');
  const [origem, setOrigem] = useState('');
  const [etapa, setEtapa] = useState('Prospecção');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (clienteInicial) {
      setNome(clienteInicial.nome);
      setPatrimonio(clienteInicial.patrimonio_total.toString());
      setAporte(clienteInicial.aporte_mensal.toString());
      setStatus(clienteInicial.status || 'Ativo');
      setOrigem(clienteInicial.origem || '');
      setEtapa(clienteInicial.etapa_atual || 'Prospecção');
    }
  }, [clienteInicial]);

  const handleMoedaInput = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => {
    let value = e.target.value.replace(/\D/g, "");
    if (!value) value = "0";
    const numericValue = parseInt(value) / 100;
    setter(numericValue.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return setError('Nome é obrigatório');

    setLoading(true);
    setError(null);
    try {
      const payload = {
        nome,
        patrimonio_total: parseFloat(patrimonio),
        aporte_mensal: parseFloat(aporte),
        status,
        origem: origem || null,
        etapa_atual: etapa as Cliente['etapa_atual'],
      };
      if (clienteInicial?.id) await atualizarCliente(clienteInicial.id, payload);
      else await criarCliente(payload);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-600 transition-all text-xs";
  const labelStyle = "block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Nome */}
      <div>
        <label className={labelStyle}>Nome Completo</label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className={inputStyle}
          placeholder="Ex: Roberto Carlos"
        />
      </div>

      {/* Origem e Etapa */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelStyle}>Origem</label>
          <select value={origem} onChange={(e) => setOrigem(e.target.value)} className={inputStyle}>
            <option value="">Não informado</option>
            {ORIGENS_PADRAO.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className={labelStyle}>Etapa do Atendimento</label>
          <select value={etapa} onChange={(e) => setEtapa(e.target.value)} className={inputStyle}>
            {ETAPAS.map(et => <option key={et} value={et}>{et}</option>)}
          </select>
        </div>
      </div>

      {/* Patrimônio e Aporte */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelStyle}>Patrimônio Líquido</label>
          <div className="relative">
            <span className="absolute left-4 top-3.5 text-[10px] font-black text-slate-300">R$</span>
            <input
              type="text"
              value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(parseFloat(patrimonio))}
              onChange={(e) => handleMoedaInput(e, setPatrimonio)}
              className={`${inputStyle} pl-10`}
            />
          </div>
        </div>
        <div>
          <label className={labelStyle}>Aporte Mensal</label>
          <div className="relative">
            <span className="absolute left-4 top-3.5 text-[10px] font-black text-slate-300">R$</span>
            <input
              type="text"
              value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(parseFloat(aporte))}
              onChange={(e) => handleMoedaInput(e, setAporte)}
              className={`${inputStyle} pl-10`}
            />
          </div>
        </div>
      </div>

      {/* Status */}
      <div>
        <label className={labelStyle}>Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputStyle}>
          <option value="Ativo">Cliente Ativo</option>
          <option value="Inativo">Inativo / Arquivado</option>
        </select>
      </div>

      {error && <div className="p-4 bg-rose-50 text-rose-600 text-xs font-bold rounded-2xl">{error}</div>}

      <div className="flex gap-3 pt-4">
        <Button variant="ghost" onClick={onCancel} className="flex-1 text-xs uppercase tracking-widest">
          Cancelar
        </Button>
        <Button variant="primary" type="submit" isLoading={loading} className="flex-1 text-xs uppercase tracking-widest">
          Salvar Dados
        </Button>
      </div>
    </form>
  );
};

export default FormularioCliente;