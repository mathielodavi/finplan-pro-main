
import React, { useState, useEffect } from 'react';
import { carteiraRecomendadaService } from '../services/carteiraRecomendadaService';
import { useProntuarioNav } from '../context/ProntuarioNavContext';
import Button from '../components/UI/Button';
import SidePanel from '../components/UI/SidePanel';
import ImportacaoCarteira from '../components/Carteira/ImportacaoCarteira';
import TabelaCarteira from '../components/Carteira/TabelaCarteira';
import ConsultaCarteira from '../components/Carteira/ConsultaCarteira';
import { FileSpreadsheet, Download, Plus, PieChart, Search, LayoutList } from 'lucide-react';
import * as XLSX from 'xlsx';

const CARTEIRA_TABS = [
  { id: 'recomendada', label: 'Carteira Recomendada', icon: <LayoutList size={16} /> },
  { id: 'consulta', label: 'Consulta de Carteira', icon: <Search size={16} /> },
];

const CarteiraPage: React.FC = () => {
  const { setNav } = useProntuarioNav();
  const [activeTab, setActiveTab] = useState('recomendada');
  const [ativos, setAtivos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerImport, setDrawerImport] = useState(false);

  // Publica as abas da Carteira no header (Navbar) — layout padrão de navegação
  // por abas em telas com múltiplas visões (ver DESIGN.MD §8).
  useEffect(() => {
    setNav({ tabs: CARTEIRA_TABS, activeTab, setActiveTab });
    return () => setNav(null);
  }, [activeTab, setNav]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const data = await carteiraRecomendadaService.listarAtivos();
      setAtivos(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregarDados(); }, []);

  const handleExportTemplate = () => {
    const template = [
      {
        estrategia: 'Moderada',
        faixa: 'Acima de 1MM',
        nome_ativo: 'Tesouro IPCA+ 2029',
        variacoes: '',
        origem: 'bancario',
        ticker: '',
        cnpj: '',
        tipo: 'Tesouro',
        alocacao: 15.5,
        asset: 'Renda Fixa IPCA+',
        instituicao: 'XP, BTG',
        observacoes: 'Ativo para proteção'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo Carteira");
    XLSX.writeFile(wb, "Modelo-Carteira-Vibe.xlsx");
  };

  const estrategiasUnicas = Array.from(new Set(ativos.map(a => a.estrategias_base?.nome))).length;

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-subtle pb-6">
        <div className="flex items-center gap-4 bg-surface px-5 py-4 rounded-xl border border-subtle">
          <div className="h-9 w-9 flex-shrink-0 bg-primary/10 text-primary rounded-[8px] flex items-center justify-center">
            <PieChart size={16} />
          </div>
          <div>
            <p className="text-[10px] text-faint font-bold uppercase tracking-wider leading-none mb-1">Estratégias Atendidas</p>
            <p className="text-[24px] font-bold text-main leading-none tracking-tighter">{estrategiasUnicas}</p>
          </div>
        </div>

        <div className="flex gap-2 w-full lg:w-auto">
          <Button
            variant="outline"
            onClick={handleExportTemplate}
            leftIcon={<Download size={14} />}
            className="flex-1 lg:flex-none h-9 px-4 font-bold uppercase text-[10px] tracking-wider"
          >
            Baixar Modelo
          </Button>
          <Button
            variant="primary"
            onClick={() => setDrawerImport(true)}
            leftIcon={<Plus size={14} />}
            className="flex-1 lg:flex-none h-9 px-4 font-bold uppercase text-[10px] tracking-wider"
          >
            Importar Nova
          </Button>
        </div>
      </header>

      {activeTab === 'recomendada' ? (
        loading ? (
          <div className="py-40 flex flex-col items-center justify-center gap-6">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[color:var(--primary)]"></div>
            <p className="text-faint font-bold uppercase tracking-widest text-[10px]">Lendo Tese Recomendada...</p>
          </div>
        ) : ativos.length === 0 ? (
          <div className="py-40 text-center bg-surface-2 border border-dashed border-subtle rounded-xl">
            <FileSpreadsheet size={32} className="mx-auto text-faint mb-4" />
            <h3 className="text-[14px] font-bold text-main uppercase tracking-widest">Carteira Vazia</h3>
            <p className="text-faint text-[11px] mt-2 font-bold uppercase tracking-wider">Importe a planilha modelo para começar a usar a inteligência de alocação.</p>
          </div>
        ) : (
          <TabelaCarteira ativos={ativos} />
        )
      ) : (
        <ConsultaCarteira />
      )}

      <SidePanel
        open={drawerImport}
        onClose={() => setDrawerImport(false)}
        title="Importar Tese de Investimentos"
        widthClass="max-w-lg"
      >
        <ImportacaoCarteira onSuccess={() => { setDrawerImport(false); carregarDados(); }} />
      </SidePanel>
    </div>
  );
};

export default CarteiraPage;
