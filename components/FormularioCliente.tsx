import React, { useState, useEffect } from 'react';
import { Cliente, criarCliente, atualizarCliente, obterOrigens, criarOrigem, obterTagsPorOrigem, criarTagOrigem, Origem, OrigemTag } from '../services/clienteService';
import { configService } from '../services/configuracoesService';
import Button from './UI/Button';
import { Plus, X, Check } from 'lucide-react';

interface FormularioClienteProps {
  clienteInicial?: Cliente | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const FormularioCliente: React.FC<FormularioClienteProps> = ({ clienteInicial, onSuccess, onCancel }) => {
  const [nome, setNome] = useState('');
  const [patrimonio, setPatrimonio] = useState('0');
  const [aporte, setAporte] = useState('0');
  const [status, setStatus] = useState('Ativo');

  // Novos estados para Origens e Protocolos
  const [origens, setOrigens] = useState<Origem[]>([]);
  const [protocolos, setProtocolos] = useState<any[]>([]);
  const [tagsDisponiveis, setTagsDisponiveis] = useState<OrigemTag[]>([]);

  const [origemId, setOrigemId] = useState('');
  const [protocoloId, setProtocoloId] = useState('');
  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>([]);

  // Estados para criação inline
  const [mostrandoNovaOrigem, setMostrandoNovaOrigem] = useState(false);
  const [novaOrigemNome, setNovaOrigemNome] = useState('');
  const [mostrandoNovaTag, setMostrandoNovaTag] = useState(false);
  const [novaTagNome, setNovaTagNome] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const carregarDadosBase = async () => {
      try {
        const [listaOrigens, listaProtocolos] = await Promise.all([
          obterOrigens(),
          configService.getAcompanhamentos()
        ]);
        setOrigens(listaOrigens);
        setProtocolos(listaProtocolos);
      } catch (err) {
        console.error("Erro ao carregar dados do formulário:", err);
      }
    };
    carregarDadosBase();
  }, []);

  useEffect(() => {
    if (clienteInicial) {
      setNome(clienteInicial.nome);
      setPatrimonio(clienteInicial.patrimonio_total.toString());
      setAporte(clienteInicial.aporte_mensal.toString());
      setStatus(clienteInicial.status || 'Ativo');
      setOrigemId(clienteInicial.origem_id || '');
      setProtocoloId(clienteInicial.protocolo_id || '');
      setTagsSelecionadas(clienteInicial.etiquetas_tags || []);
    }
  }, [clienteInicial]);

  useEffect(() => {
    if (origemId) {
      obterTagsPorOrigem(origemId).then(setTagsDisponiveis).catch(console.error);
    } else {
      setTagsDisponiveis([]);
    }
  }, [origemId]);

  const handleMoedaInput = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => {
    let value = e.target.value.replace(/\D/g, "");
    if (!value) value = "0";
    const numericValue = parseInt(value) / 100;
    setter(numericValue.toString());
  };

  const handleCriarOrigem = async () => {
    if (!novaOrigemNome.trim()) return;
    try {
      const nova = await criarOrigem(novaOrigemNome);
      setOrigens([...origens, nova]);
      setOrigemId(nova.id);
      setNovaOrigemNome('');
      setMostrandoNovaOrigem(false);
    } catch (err) {
      console.error("Erro ao criar origem:", err);
    }
  };

  const handleCriarTag = async () => {
    if (!novaTagNome.trim() || !origemId) return;
    try {
      const nova = await criarTagOrigem(origemId, novaTagNome);
      setTagsDisponiveis([...tagsDisponiveis, nova]);
      if (!tagsSelecionadas.includes(nova.nome)) {
        setTagsSelecionadas([...tagsSelecionadas, nova.nome]);
      }
      setNovaTagNome('');
      setMostrandoNovaTag(false);
    } catch (err) {
      console.error("Erro ao criar tag:", err);
    }
  };

  const toggleTag = (tagName: string) => {
    if (tagsSelecionadas.includes(tagName)) {
      setTagsSelecionadas(tagsSelecionadas.filter(t => t !== tagName));
    } else {
      setTagsSelecionadas([...tagsSelecionadas, tagName]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return setError('Nome é obrigatório');

    setLoading(true);
    setError(null);
    try {
      const payload: Partial<Cliente> = {
        nome,
        patrimonio_total: parseFloat(patrimonio),
        aporte_mensal: parseFloat(aporte),
        status,
        origem_id: origemId || null,
        protocolo_id: protocoloId || null,
        etiquetas_tags: tagsSelecionadas,
        // Mantém suporte retrógrado se necessário para lógica de exibição
        etapa_atual: protocolos.find(p => p.id === protocoloId)?.nome || 'Prospecção' as any
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

      {/* Origem e Protocolo */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className={labelStyle}>Origem</label>
          <div className="flex gap-2">
            {!mostrandoNovaOrigem ? (
              <select
                value={origemId}
                onChange={(e) => {
                  if (e.target.value === 'NEW') setMostrandoNovaOrigem(true);
                  else setOrigemId(e.target.value);
                }}
                className={inputStyle}
              >
                <option value="">Não informado</option>
                {origens.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                <option value="NEW" className="text-emerald-600 font-bold">+ Criar Nova Origem</option>
              </select>
            ) : (
              <div className="flex-1 flex gap-1">
                <input
                  type="text"
                  value={novaOrigemNome}
                  onChange={(e) => setNovaOrigemNome(e.target.value)}
                  className={inputStyle}
                  placeholder="Nome da Origem"
                  autoFocus
                />
                <button type="button" onClick={handleCriarOrigem} className="p-2 bg-emerald-600 text-white rounded-lg"><Check size={14} /></button>
                <button type="button" onClick={() => setMostrandoNovaOrigem(false)} className="p-2 bg-slate-100 text-slate-400 rounded-lg"><X size={14} /></button>
              </div>
            )}
          </div>
        </div>
        <div>
          <label className={labelStyle}>Protocolo de Atendimento</label>
          <select value={protocoloId} onChange={(e) => setProtocoloId(e.target.value)} className={inputStyle}>
            <option value="">Nenhum protocolo</option>
            {protocolos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
      </div>

      {/* Tags Customizadas (aparece se houver origem) */}
      {origemId && (
        <div className="space-y-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
          <div className="flex justify-between items-center">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Etiquetas da Origem</label>
            {!mostrandoNovaTag ? (
              <button
                type="button"
                onClick={() => setMostrandoNovaTag(true)}
                className="text-[9px] font-bold text-emerald-600 uppercase flex items-center gap-1 hover:underline"
              >
                <Plus size={10} /> Nova Tag
              </button>
            ) : (
              <div className="flex gap-1">
                <input
                  type="text"
                  value={novaTagNome}
                  onChange={(e) => setNovaTagNome(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] outline-none"
                  placeholder="Tag..."
                  autoFocus
                />
                <button type="button" onClick={handleCriarTag} className="text-emerald-600"><Check size={12} /></button>
                <button type="button" onClick={() => setMostrandoNovaTag(false)} className="text-slate-400"><X size={12} /></button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {tagsDisponiveis.length === 0 && !mostrandoNovaTag && (
              <span className="text-[10px] text-slate-400 italic">Nenhuma tag cadastrada para esta origem.</span>
            )}
            {tagsDisponiveis.map(tag => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.nome)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${tagsSelecionadas.includes(tag.nome)
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300'
                  }`}
              >
                {tag.nome}
              </button>
            ))}
          </div>
        </div>
      )}

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