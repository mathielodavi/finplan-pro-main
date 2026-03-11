
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClienteContext } from '../context/ClienteContext';
import { Cliente } from '../services/clienteService';
import { obterTodosContratos } from '../services/contratoService';
import { investimentoService } from '../services/investimentoService';
import { reuniaoService } from '../services/reuniaoService';
import { calcularTermometro } from '../utils/termometroUtils';
import ListaClientes from '../components/ListaClientes';
import FormularioCliente from '../components/FormularioCliente';
import Modal from '../components/Modal';
import Button from '../components/UI/Button';
import { Search, Plus, Filter, Users, AlertCircle } from 'lucide-react';

const ClientesPage: React.FC = () => {
  const navigate = useNavigate();
  const { clientes, loading: loadingClientes, refreshClientes } = useClienteContext();
  const [contratos, setContratos] = useState<any[]>([]);
  const [ativos, setAtivos] = useState<any[]>([]);
  const [reunioes, setReunioes] = useState<any[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(false);

  const [modalAberto, setModalAberto] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'Todos' | 'Ativo' | 'Inativo' | 'Sem Planejamento'>('Ativo');

  const carregarDados = async () => {
    setLoadingExtras(true);
    try {
      // Carregamento paralelo para agilidade
      const [_, cData, aData, rData] = await Promise.all([
        refreshClientes(),
        obterTodosContratos(),
        investimentoService.getAtivos(''), // Busca todos os ativos acessíveis
        reuniaoService.getPorCliente('') // Busca todas as reuniões acessíveis
      ]);
      setContratos(cData || []);
      setAtivos(aData || []);
      setReunioes(rData || []);
    } catch (err) {
      console.error("Erro ao sincronizar dados da carteira:", err);
    } finally {
      setLoadingExtras(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [refreshClientes]);

  const handleNovoCliente = () => {
    setClienteSelecionado(null);
    setModalAberto(true);
  };

  const handleSucessoForm = (cliente?: Cliente) => {
    setModalAberto(false);
    if (!clienteSelecionado && cliente && cliente.id && cliente.status === 'Ativo') {
      navigate(`/clientes/${cliente.id}`);
    } else {
      carregarDados();
    }
  };

  // Identifica IDs de clientes que possuem contrato de planejamento ativo
  const idsComPlanejamento = useMemo(() => {
    return new Set(
      contratos
        .filter(c => c.tipo === 'planejamento' && c.status === 'ativo')
        .map(c => c.cliente_id)
    );
  }, [contratos]);

  // Consolidação de dados por cliente (Patrimônio Real e Saúde)
  const clientesProcessados = useMemo(() => {
    return clientes.map(c => {
      // 1. Soma dos ativos da "Carteira Ativa"
      const patrimonioCalculado = ativos
        .filter(a => a.cliente_id === c.id)
        .reduce((acc, cur) => acc + (cur.valor_atual || 0), 0);

      // 2. Cálculo do Termômetro Real
      const cliReunioes = reunioes.filter(r => r.cliente_id === c.id);
      const ultima = cliReunioes.find(r => r.status === 'realizada')?.data_reuniao || null;
      const proxima = cliReunioes.find(r => r.status === 'agendada')?.data_reuniao || null;
      const termometro = calcularTermometro(ultima, proxima);

      return {
        ...c,
        patrimonio_real: patrimonioCalculado,
        termometro
      };
    });
  }, [clientes, ativos, reunioes]);

  const clientesFiltrados = clientesProcessados.filter(c => {
    const matchBusca = c.nome.toLowerCase().includes(termoBusca.toLowerCase());

    if (filtroStatus === 'Sem Planejamento') {
      return matchBusca && !idsComPlanejamento.has(c.id);
    }

    const matchStatus = filtroStatus === 'Todos' || c.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  const loading = loadingClientes || loadingExtras;

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex flex-col sm:flex-row gap-4 w-full items-center">
        <div className="relative group flex-[2]">
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            className="pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all w-full font-semibold text-xs"
          />
          <Search className="h-5 w-5 absolute left-4 top-3 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
        </div>
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value as any)}
          className={`border rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all shadow-sm ${filtroStatus === 'Sem Planejamento' ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-slate-200 text-slate-700'
            }`}
        >
          <option value="Todos">Todos os Clientes</option>
          <option value="Ativo">Apenas Ativos</option>
          <option value="Inativo">Apenas Inativos</option>
          <option value="Sem Planejamento">⚠️ Sem Planejamento</option>
        </select>
        <Button
          onClick={handleNovoCliente}
          leftIcon={<Plus size={16} />}
          className="shadow-md py-3 px-6 text-[10px] uppercase tracking-widest flex-shrink-0"
        >
          Novo Cliente
        </Button>
      </header>

      {filtroStatus === 'Sem Planejamento' && clientesFiltrados.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-center gap-3 animate-slide-up">
          <div className="h-8 w-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
            <AlertCircle size={16} />
          </div>
          <div>
            <p className="text-[9px] font-black text-amber-800 uppercase tracking-widest">Atenção Comercial</p>
            <p className="text-[11px] text-amber-700 font-medium">Estes clientes não possuem um ciclo de planejamento ativo. Recomenda-se o agendamento de uma reunião de diagnóstico.</p>
          </div>
        </div>
      )}

      {loading && !clientes.length ? (
        <div className="py-32 flex flex-col items-center justify-center gap-6">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
          <p className="text-slate-300 font-bold uppercase tracking-[0.2em] text-[10px]">Sincronizando carteira...</p>
        </div>
      ) : (
        <ListaClientes
          clientes={clientesFiltrados}
          onEdit={(c) => { setClienteSelecionado(c); setModalAberto(true); }}
          onView={(c) => navigate(`/clientes/${c.id}`)}
          onRefresh={carregarDados}
        />
      )}

      <Modal isOpen={modalAberto} onClose={() => setModalAberto(false)} title={clienteSelecionado ? 'Editar Cadastro' : 'Novo Cliente'}>
        <FormularioCliente
          clienteInicial={clienteSelecionado}
          onSuccess={handleSucessoForm}
          onCancel={() => setModalAberto(false)}
        />
      </Modal>
    </div>
  );
};

export default ClientesPage;
