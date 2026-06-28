
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClienteContext } from '../context/ClienteContext';
import { Cliente } from '../services/clienteService';
import { obterTodosContratos } from '../services/contratoService';
import { investimentoService } from '../services/investimentoService';
import { reuniaoService } from '../services/reuniaoService';
import { dividasService } from '../services/dividasService';
import { protecaoService } from '../services/protecaoService';
import { calcularTermometro } from '../utils/termometroUtils';
import { categorizarAgendaCliente } from '../utils/agendaUtils';
import ListaClientes from '../components/ListaClientes';
import FormularioCliente from '../components/FormularioCliente';
import SidePanel from '../components/UI/SidePanel';
import Button from '../components/UI/Button';
import { Search, Plus } from 'lucide-react';

const ClientesPage: React.FC = () => {
  const navigate = useNavigate();
  const { clientes, loading: loadingClientes, refreshClientes } = useClienteContext();
  const [contratos, setContratos] = useState<any[]>([]);
  const [ativos, setAtivos] = useState<any[]>([]);
  const [reunioes, setReunioes] = useState<any[]>([]);
  const [saldoDevedorPorCliente, setSaldoDevedorPorCliente] = useState<Map<string, number>>(new Map());
  const [scoresProtecaoPorCliente, setScoresProtecaoPorCliente] = useState<Map<string, number>>(new Map());
  const [loadingExtras, setLoadingExtras] = useState(false);

  const [modalAberto, setModalAberto] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'Todos' | 'Ativo' | 'Inativo'>('Ativo');

  const carregarDados = async () => {
    setLoadingExtras(true);
    try {
      // Carregamento paralelo para agilidade
      const [_, cData, aData, rData, saldoDevedor, scoresProtecao] = await Promise.all([
        refreshClientes(),
        obterTodosContratos(),
        investimentoService.getAtivos(''), // Busca todos os ativos acessíveis
        reuniaoService.getPorCliente(''), // Busca todas as reuniões acessíveis
        dividasService.getSaldoDevedorPorCliente(),
        protecaoService.getScoresPorCliente()
      ]);
      setContratos(cData || []);
      setAtivos(aData || []);
      setReunioes(rData || []);
      setSaldoDevedorPorCliente(saldoDevedor);
      setScoresProtecaoPorCliente(scoresProtecao);
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

      // 3. Próxima Ação (mesma lógica usada na Agenda do Dashboard)
      const proximaAcao = categorizarAgendaCliente(cliReunioes);

      // 4. Patrimônio líquido (investimentos - saldo devedor) e % de proteção
      const saldoDevedor = (c.id ? saldoDevedorPorCliente.get(c.id) : 0) || 0;
      const percentualProtecao = (c.id ? scoresProtecaoPorCliente.get(c.id) : 0) ?? 0;

      return {
        ...c,
        patrimonio_real: patrimonioCalculado,
        patrimonio_liquido: patrimonioCalculado - saldoDevedor,
        termometro,
        proximaAcao,
        temPlanoAtivo: idsComPlanejamento.has(c.id),
        percentualProtecao
      };
    });
  }, [clientes, ativos, reunioes, idsComPlanejamento, saldoDevedorPorCliente, scoresProtecaoPorCliente]);

  const clientesFiltrados = clientesProcessados.filter(c => {
    const matchBusca = c.nome.toLowerCase().includes(termoBusca.toLowerCase());
    const matchStatus = filtroStatus === 'Todos' || c.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  const loading = loadingClientes || loadingExtras;

  const statusOptions: { id: typeof filtroStatus; label: string }[] = [
    { id: 'Ativo', label: 'Ativos' },
    { id: 'Inativo', label: 'Inativos' },
    { id: 'Todos', label: 'Todos' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <header className="flex flex-col sm:flex-row gap-3 w-full sm:items-center sm:justify-between">
        {/* Segmented control de status */}
        <div className="flex bg-surface-2 p-1 rounded-lg border border-subtle w-full sm:w-auto">
          {statusOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => setFiltroStatus(opt.id)}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-md text-[12px] font-semibold transition-all whitespace-nowrap ${
                filtroStatus === opt.id ? 'bg-surface-3 text-primary' : 'text-faint hover:text-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative group flex-1 sm:flex-none sm:w-56">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-faint group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Filtrar na lista..."
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              className="pl-9 pr-3 h-9 bg-surface-2 border border-subtle rounded-lg outline-none focus:border-primary transition-all w-full font-medium text-[13px] text-main placeholder:text-faint"
            />
          </div>
          <Button onClick={handleNovoCliente} leftIcon={<Plus size={14} />} size="sm">
            Novo Cliente
          </Button>
        </div>
      </header>

      {loading && !clientes.length ? (
        <div className="py-32 flex flex-col items-center justify-center gap-6">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[color:var(--primary)]"></div>
          <p className="text-faint font-semibold uppercase tracking-[0.2em] text-[10px]">Sincronizando carteira...</p>
        </div>
      ) : (
        <ListaClientes
          clientes={clientesFiltrados}
          onEdit={(c) => { setClienteSelecionado(c); setModalAberto(true); }}
          onView={(c) => navigate(`/clientes/${c.id}`)}
          onRefresh={carregarDados}
        />
      )}

      <SidePanel
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={clienteSelecionado ? 'Editar Cadastro' : 'Novo Cliente'}
        subtitle={clienteSelecionado ? clienteSelecionado.nome : 'Cadastro de cliente na carteira'}
      >
        <FormularioCliente
          clienteInicial={clienteSelecionado}
          onSuccess={handleSucessoForm}
          onCancel={() => setModalAberto(false)}
        />
      </SidePanel>
    </div>
  );
};

export default ClientesPage;
