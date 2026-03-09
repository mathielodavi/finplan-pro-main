
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { obterClientePorId, Cliente } from '../services/clienteService';
import { reuniaoService, Reuniao } from '../services/reuniaoService';
import { obterContratosPorCliente } from '../services/contratoService';
import { investimentoService } from '../services/investimentoService';
import Badge from '../components/UI/Badge';
import Button from '../components/UI/Button';
import { ChevronLeft, FileText, Share2, TrendingUp, History, ClipboardList, Wallet, Shield, CreditCard, Clock } from 'lucide-react';

// Abas
import AbaResumo from '../components/Prontuario/AbaResumo';
import AbaReunioes from '../components/Prontuario/AbaReunioes';
import AbaAtendimento from '../components/Prontuario/AbaAtendimento';
import AbaInvestimentos from '../components/Prontuario/AbaInvestimentos';
import ModalGerarRelatorio from '../components/Relatorios/ModalGerarRelatorio';
import StepperProtecao from '../components/Protecao/StepperProtecao';
import AbaDividas from '../components/Dividas/AbaDividas';


const ProntuarioPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  if (loading && !cliente) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-6">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        <p className="text-slate-300 font-bold uppercase tracking-[0.2em] text-[10px]">Sincronizando prontuário...</p>
      </div>
    );
  }

  if (!cliente) return null;

  const tabs = [
    { id: 'resumo', label: 'Estratégia', icon: <TrendingUp size={16} /> },
    { id: 'atendimento', label: 'Checklist', icon: <ClipboardList size={16} /> },
    { id: 'protecao', label: 'Proteção', icon: <Shield size={16} /> },
    { id: 'investimentos', label: 'Patrimônio', icon: <Wallet size={16} /> },
    { id: 'dividas', label: 'Dívidas', icon: <CreditCard size={16} /> },
    { id: 'reunioes', label: 'Histórico', icon: <History size={16} /> }
  ];

  return (
    <div className="space-y-8 animate-fade-in max-w-[1400px] mx-auto">
      <header className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate('/clientes')}
            className="p-2.5 bg-slate-50 hover:bg-emerald-50 text-slate-300 hover:text-emerald-600 rounded-xl transition-all group"
            title="Voltar para Carteira"
          >
            <ChevronLeft size={18} strokeWidth={3} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{cliente.nome}</h1>
              <Badge variant="emerald" size="sm">{cliente.status || 'Ativo'}</Badge>
            </div>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Dossiê Financeiro Consolidado</p>
          </div>
        </div>

        <div className="flex gap-3 w-full lg:w-auto">
          <Button variant="outline" className="flex-1 lg:flex-none uppercase text-[10px] tracking-widest px-6">
            Compartilhar
          </Button>
          <Button variant="primary" className="flex-1 lg:flex-none uppercase text-[10px] tracking-widest px-8" onClick={() => setModalPDF(true)}>
            Gerar PDF
          </Button>
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[600px]">
        <div className="flex bg-slate-50/50 border-b border-slate-100 px-4 pt-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] flex items-center transition-all relative group whitespace-nowrap rounded-t-2xl ${activeTab === tab.id
                ? 'text-emerald-600 bg-white shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100 border-b-0 -mb-[1px]'
                : 'text-slate-400 hover:text-slate-600 hover:bg-white/50 border border-transparent'
                }`}
            >
              <span className={`transition-opacity ${activeTab === tab.id ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}`}>
                {tab.icon}
              </span>
              <span className={`overflow-hidden transition-all duration-300 ease-in-out flex items-center ${activeTab === tab.id ? 'max-w-[200px] opacity-100 ml-3' : 'max-w-0 opacity-0 group-hover:max-w-[200px] group-hover:opacity-100 group-hover:ml-3'}`}>
                {tab.label}
              </span>
              {activeTab === tab.id && <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-600 rounded-t-full" />}
            </button>
          ))}
        </div>

        <div className="p-8">
          {activeTab === 'resumo' && <AbaResumo cliente={cliente} onUpdate={loadData} />}
          {activeTab === 'atendimento' && <AbaAtendimento clienteId={cliente.id!} />}
          {activeTab === 'protecao' && (
            <StepperProtecao clienteId={cliente.id!} nomeCliente={cliente.nome} />
          )}
          {activeTab === 'investimentos' && <AbaInvestimentos clienteId={cliente.id!} />}
          {activeTab === 'dividas' && <AbaDividas clienteId={cliente.id!} rendaMensalCliente={cliente.renda_mensal || 0} />}

          {activeTab === 'reunioes' && <AbaReunioes clienteId={cliente.id!} reunioes={reunioes} onRefresh={loadData} />}
        </div>
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
