
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { obterClientePorId, Cliente } from '../services/clienteService';
import { reuniaoService, Reuniao } from '../services/reuniaoService';
import { obterContratosPorCliente } from '../services/contratoService';
import { investimentoService } from '../services/investimentoService';
import { useClienteContext } from '../context/ClienteContext';
import { useProntuarioNav } from '../context/ProntuarioNavContext';
import Button from '../components/UI/Button';
import { TrendingUp, History, ClipboardList, Wallet, Shield, CreditCard } from 'lucide-react';

// Abas
import AbaResumo from '../components/Prontuario/AbaResumo';
import AbaReunioes from '../components/Prontuario/AbaReunioes';
import AbaAtendimento from '../components/Prontuario/AbaAtendimento';
import AbaInvestimentos from '../components/Prontuario/AbaInvestimentos';
import ModalGerarRelatorio from '../components/Relatorios/ModalGerarRelatorio';
import StepperProtecao from '../components/Protecao/StepperProtecao';
import AbaDividas from '../components/Dividas/AbaDividas';


const TABS = [
  { id: 'resumo', label: 'Estratégia', icon: <TrendingUp size={16} /> },
  { id: 'atendimento', label: 'Checklist', icon: <ClipboardList size={16} /> },
  { id: 'protecao', label: 'Proteção', icon: <Shield size={16} /> },
  { id: 'investimentos', label: 'Patrimônio', icon: <Wallet size={16} /> },
  { id: 'dividas', label: 'Dívidas', icon: <CreditCard size={16} /> },
  { id: 'reunioes', label: 'Histórico', icon: <History size={16} /> },
];

const ProntuarioPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setClienteAtivo } = useClienteContext();
  const { setNav } = useProntuarioNav();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [activeTab, setActiveTab] = useState('resumo');
  const [loading, setLoading] = useState(true);
  const [modalPDF, setModalPDF] = useState(false);
  const [contratos, setContratos] = useState<any[]>([]);
  const [ativos, setAtivos] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [cData, rData, ctData, aData] = await Promise.all([
        obterClientePorId(id),
        reuniaoService.getPorCliente(id),
        obterContratosPorCliente(id),
        investimentoService.getAtivos(id)
      ]);
      setCliente(cData);
      setReunioes(rData || []);
      setContratos(ctData || []);
      setAtivos(aData || []);
    } catch (err) {
      console.error("Erro ao carregar prontuário:", err);
      navigate('/clientes');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  // Alimenta o header (breadcrumb + seletor de cliente) e limpa ao sair
  useEffect(() => {
    if (cliente?.id) setClienteAtivo({ id: cliente.id, nome: cliente.nome, status: cliente.status });
    return () => setClienteAtivo(null);
  }, [cliente, setClienteAtivo]);

  // Publica as abas + ações no header (Navbar). O submenu é publicado pelas abas filhas.
  useEffect(() => {
    setNav({
      tabs: TABS,
      activeTab,
      setActiveTab,
      actions: (
        <>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex">Compartilhar</Button>
          <Button variant="primary" size="sm" onClick={() => setModalPDF(true)}>Gerar PDF</Button>
        </>
      ),
    });
    return () => setNav(null);
  }, [activeTab, setNav]);

  if (loading && !cliente) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-6">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[color:var(--primary)]"></div>
        <p className="text-faint font-semibold uppercase tracking-[0.2em] text-[10px]">Sincronizando prontuário...</p>
      </div>
    );
  }

  if (!cliente) return null;

  return (
    <div className="animate-fade-in max-w-[1400px] mx-auto">
      {/* Conteúdo da aba (navegação vive no header) */}
      <div className="min-h-[560px]">
        {activeTab === 'resumo' && <AbaResumo cliente={cliente} onUpdate={loadData} />}
        {activeTab === 'atendimento' && <AbaAtendimento clienteId={cliente.id!} />}
        {activeTab === 'protecao' && (
          <StepperProtecao clienteId={cliente.id!} nomeCliente={cliente.nome} />
        )}
        {activeTab === 'investimentos' && <AbaInvestimentos clienteId={cliente.id!} />}
        {activeTab === 'dividas' && <AbaDividas clienteId={cliente.id!} rendaMensalCliente={cliente.renda_mensal || 0} />}
        {activeTab === 'reunioes' && <AbaReunioes clienteId={cliente.id!} reunioes={reunioes} onRefresh={loadData} />}
      </div>

      <ModalGerarRelatorio
        isOpen={modalPDF}
        onClose={() => setModalPDF(false)}
        cliente={cliente}
        contratos={contratos}
        ativos={ativos}
        projetos={[]}
        reunioes={reunioes}
        onGenerated={loadData}
      />
    </div>
  );
};

export default ProntuarioPage;
