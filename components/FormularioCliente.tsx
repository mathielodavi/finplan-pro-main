import React, { useState, useEffect } from 'react';
import { Cliente, criarCliente, atualizarCliente, obterOrigens, criarOrigem, obterTagsPorOrigem, criarTagOrigem, Origem, OrigemTag } from '../services/clienteService';
import { mascaraCPF, mascaraTelefone } from '../utils/calculosFinanceiros';
import { UFS } from '../utils/formatadores';
import Button from './UI/Button';
import CampoMoeda from './UI/CampoMoeda';
import { Plus, X, Check } from 'lucide-react';

interface FormularioClienteProps {
  clienteInicial?: Cliente | null;
  onSuccess: (cliente?: Cliente) => void;
  onCancel: () => void;
}

const FormularioCliente: React.FC<FormularioClienteProps> = ({ clienteInicial, onSuccess, onCancel }) => {
  const [nome, setNome] = useState('');
  const [patrimonio, setPatrimonio] = useState('0');
  const [aporte, setAporte] = useState('0');
  const [dividasIniciais, setDividasIniciais] = useState('0');
  const [reservaInicial, setReservaInicial] = useState('0');
  const [status, setStatus] = useState('Ativo');
  const [estado, setEstado] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');

  const [cpf, setCpf] = useState('');
  const [profissao, setProfissao] = useState('');

  const [origens, setOrigens] = useState<Origem[]>([]);
  const [tagsDisponiveis, setTagsDisponiveis] = useState<OrigemTag[]>([]);

  const [origemId, setOrigemId] = useState('');
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
        setOrigens(await obterOrigens());
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
      setTagsSelecionadas(clienteInicial.etiquetas_tags || []);
      setEstado(clienteInicial.estado || '');
      setTelefone(clienteInicial.telefone || '');
      setEmail(clienteInicial.email || '');
      setDataNascimento(clienteInicial.data_nascimento || '');
      setCpf(clienteInicial.cpf || '');
      setProfissao(clienteInicial.profissao || '');
      setDividasIniciais((clienteInicial.dividas_iniciais || 0).toString());
      setReservaInicial((clienteInicial.reserva_emergencia_inicial || 0).toString());
    }
  }, [clienteInicial]);

  useEffect(() => {
    if (origemId) {
      obterTagsPorOrigem(origemId).then(setTagsDisponiveis).catch(console.error);
    } else {
      setTagsDisponiveis([]);
    }
  }, [origemId]);

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
        etiquetas_tags: tagsSelecionadas,
        pais: 'Brasil',
        estado: estado || undefined,
        telefone: telefone || undefined,
        email: email || undefined,
        data_nascimento: dataNascimento || null,
        cpf: cpf || null,
        profissao: profissao || null,
        dividas_iniciais: parseFloat(dividasIniciais) || 0,
        reserva_emergencia_inicial: parseFloat(reservaInicial) || 0,
      };
      if (clienteInicial?.id) {
        await atualizarCliente(clienteInicial.id, payload);
        onSuccess(clienteInicial);
      } else {
        const novo = await criarCliente(payload);
        onSuccess(novo as Cliente);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = "w-full px-4 py-2.5 bg-surface-2 border border-subtle rounded-xl font-medium text-main outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-600 transition-all text-[13px]";
  const labelStyle = "block text-[11px] font-semibold text-muted mb-1.5 ml-0.5";
  const sectionTitle = "text-[11px] font-bold text-faint uppercase tracking-wider";

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      {/* ── Identificação ── */}
      <section className="space-y-4">
        <h3 className={sectionTitle}>Identificação</h3>
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelStyle}>Telefone</label>
            <input
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
              className={inputStyle}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div>
            <label className={labelStyle}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputStyle}
              placeholder="cliente@exemplo.com"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelStyle}>País</label>
            <select value="Brasil" disabled className={`${inputStyle} opacity-70 cursor-not-allowed`}>
              <option value="Brasil">Brasil</option>
            </select>
          </div>
          <div>
            <label className={labelStyle}>Estado</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value)} className={inputStyle}>
              <option value="">Não informado</option>
              {UFS.map(uf => <option key={uf.sigla} value={uf.sigla}>{uf.nome}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelStyle}>Data de Nascimento</label>
            <input
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className={inputStyle}
            />
          </div>
          <div>
            <label className={labelStyle}>CPF</label>
            <input
              type="text"
              value={cpf}
              onChange={(e) => setCpf(mascaraCPF(e.target.value))}
              maxLength={14}
              className={inputStyle}
              placeholder="000.000.000-00"
            />
          </div>
        </div>
        <div>
          <label className={labelStyle}>Profissão</label>
          <input
            type="text"
            value={profissao}
            onChange={(e) => setProfissao(e.target.value)}
            className={inputStyle}
            placeholder="Ex: Médico, Engenheiro..."
          />
        </div>
      </section>

      {/* ── Comercial ── */}
      <section className="space-y-4">
        <h3 className={sectionTitle}>Comercial</h3>
        <div>
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
                  <button type="button" onClick={() => setMostrandoNovaOrigem(false)} className="p-2 bg-surface-2 text-faint rounded-lg"><X size={14} /></button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tags Customizadas (aparece se houver origem) */}
        {origemId && (
          <div className="space-y-3 p-4 bg-surface-2 border border-subtle rounded-xl">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-semibold text-muted">Etiquetas da Origem</label>
              {!mostrandoNovaTag ? (
                <button
                  type="button"
                  onClick={() => setMostrandoNovaTag(true)}
                  className="text-[11px] font-semibold text-primary flex items-center gap-1 hover:underline"
                >
                  <Plus size={11} /> Nova Tag
                </button>
              ) : (
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={novaTagNome}
                    onChange={(e) => setNovaTagNome(e.target.value)}
                    className="px-2 py-1 bg-surface border border-subtle rounded text-[11px] text-main outline-none"
                    placeholder="Tag..."
                    autoFocus
                  />
                  <button type="button" onClick={handleCriarTag} className="text-primary"><Check size={12} /></button>
                  <button type="button" onClick={() => setMostrandoNovaTag(false)} className="text-faint"><X size={12} /></button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {tagsDisponiveis.length === 0 && !mostrandoNovaTag && (
                <span className="text-[11px] text-faint italic">Nenhuma tag cadastrada para esta origem.</span>
              )}
              {tagsDisponiveis.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.nome)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${tagsSelecionadas.includes(tag.nome)
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-surface text-muted border-subtle hover:border-emerald-500/50'
                    }`}
                >
                  {tag.nome}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Situação Inicial (snapshot de onboarding) ── */}
      <section className="space-y-4">
        <div>
          <h3 className={sectionTitle}>Situação Inicial</h3>
          <p className="text-[11px] text-faint mt-1">Retrato do momento de entrada do cliente. Informativo — não altera os módulos vivos.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelStyle}>Patrimônio Financeiro Inicial</label>
            <CampoMoeda value={parseFloat(patrimonio) || 0} onChange={(n) => setPatrimonio(String(n))} className={inputStyle} />
          </div>
          <div>
            <label className={labelStyle}>Aporte Mensal</label>
            <CampoMoeda value={parseFloat(aporte) || 0} onChange={(n) => setAporte(String(n))} className={inputStyle} />
          </div>
          <div>
            <label className={labelStyle}>Dívidas Iniciais</label>
            <CampoMoeda value={parseFloat(dividasIniciais) || 0} onChange={(n) => setDividasIniciais(String(n))} className={inputStyle} />
          </div>
          <div>
            <label className={labelStyle}>Reserva de Emergência Inicial</label>
            <CampoMoeda value={parseFloat(reservaInicial) || 0} onChange={(n) => setReservaInicial(String(n))} className={inputStyle} />
          </div>
        </div>
      </section>

      {/* ── Status ── */}
      <section className="space-y-4">
        <h3 className={sectionTitle}>Status</h3>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputStyle}>
          <option value="Ativo">Cliente Ativo</option>
          <option value="Inativo">Inativo / Arquivado</option>
        </select>
      </section>

      {error && (
        <div className="p-4 text-[13px] font-semibold rounded-xl border border-subtle text-[color:var(--danger)]" style={{ backgroundColor: 'rgba(248,113,113,0.10)' }}>
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel} type="button" className="flex-1">
          Cancelar
        </Button>
        <Button variant="primary" type="submit" isLoading={loading} className="flex-1">
          Salvar Dados
        </Button>
      </div>
    </form>
  );
};

export default FormularioCliente;