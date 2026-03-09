
import React, { useState, useEffect } from 'react';
import { carteiraRecomendadaService } from '../services/carteiraRecomendadaService';
import { formatarMoeda } from '../utils/formatadores';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Modal from '../components/Modal';
import ImportacaoCarteira from '../components/Carteira/ImportacaoCarteira';
import TabelaCarteira from '../components/Carteira/TabelaCarteira';
import { FileSpreadsheet, Download, Plus, AlertCircle, PieChart, Layers, Info } from 'lucide-react';
import * as XLSX from 'xlsx';

const CarteiraPage: React.FC = () => {
  const [ativos, setAtivos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalImport, setModalImport] = useState(false);

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

  const totalAtivos = ativos.length;
  const estrategiasUnicas = Array.from(new Set(ativos.map(a => a.estrategias_base?.nome))).length;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-slate-200 pb-8">
        <div className="flex items-center gap-6 bg-blue-50/50 px-5 py-3 rounded-2xl border border-blue-100 shadow-sm">
          <div className="h-10 w-10 flex-shrink-0 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shadow-inner">
            <PieChart size={20} />
          </div>
          <div>
            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest leading-none mb-1">Estratégias Atendidas</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-slate-900 leading-none">{estrategiasUnicas}</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest hidden sm:block">Capilaridade de Teses</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 w-full lg:w-auto">
          <Button
            variant="outline"
            onClick={handleExportTemplate}
            leftIcon={<Download size={16} />}
            className="flex-1 lg:flex-none uppercase text-[10px] tracking-widest"
          >
            Baixar Modelo
          </Button>
          <Button
            variant="primary"
            onClick={() => setModalImport(true)}
            leftIcon={<Plus size={16} />}
            className="flex-1 lg:flex-none uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-500/10"
          >
            Importar Nova
          </Button>
        </div>
      </header>

      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3 text-emerald-800">
        <div className="h-8 w-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Info size={16} />
        </div>
        <p className="text-[11px] font-medium leading-relaxed">
          <span className="font-bold uppercase tracking-widest text-[9px] mr-2 text-emerald-700">Info Importante</span>
          Toda nova importação substitui os dados anteriores. Mantenha seu arquivo mestre atualizado para garantir a integridade do rebalanceamento.
        </p>
      </div>

      {loading ? (
        <div className="py-40 flex flex-col items-center justify-center gap-6">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
          <p className="text-slate-300 font-bold uppercase tracking-widest text-[10px]">Lendo Tese Recomendada...</p>
        </div>
      ) : ativos.length === 0 ? (
        <div className="py-40 text-center bg-white border border-dashed border-slate-200 rounded-[3rem]">
          <FileSpreadsheet size={48} className="mx-auto text-slate-100 mb-6" />
          <h3 className="text-xl font-black text-slate-400 uppercase">Carteira Vazia</h3>
          <p className="text-slate-400 text-sm mt-2 font-medium">Importe a planilha modelo para começar a usar a inteligência de alocação.</p>
        </div>
      ) : (
        <TabelaCarteira ativos={ativos} />
      )}

      <Modal isOpen={modalImport} onClose={() => setModalImport(false)} title="Importar Tese de Investimentos" size="lg">
        <ImportacaoCarteira onSuccess={() => { setModalImport(false); carregarDados(); }} />
      </Modal>
    </div>
  );
};

export default CarteiraPage;
