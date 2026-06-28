
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
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-subtle pb-6">
        <div className="flex items-center gap-4 bg-surface px-5 py-4 rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <div className="h-9 w-9 flex-shrink-0 bg-blue-50 text-blue-600 rounded-[8px] flex items-center justify-center">
            <PieChart size={16} />
          </div>
          <div>
            <p className="text-[10px] text-faint font-bold uppercase tracking-wider leading-none mb-1">Estratégias Atendidas</p>
            <div className="flex items-baseline gap-2">
              <p className="text-[24px] font-bold text-main leading-none tracking-tighter">{estrategiasUnicas}</p>
              <p className="text-[10px] text-faint font-bold uppercase tracking-wider hidden sm:block">Capilaridade de Teses</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 w-full lg:w-auto">
          <Button
            variant="outline"
            onClick={handleExportTemplate}
            leftIcon={<Download size={14} />}
            className="flex-1 lg:flex-none h-9 px-4 font-bold uppercase text-[10px] tracking-wider border border-subtle text-muted hover:bg-surface-2"
          >
            Baixar Modelo
          </Button>
          <Button
            variant="primary"
            onClick={() => setModalImport(true)}
            leftIcon={<Plus size={14} />}
            className="flex-1 lg:flex-none h-9 px-4 font-bold uppercase text-[10px] tracking-wider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-[8px]"
          >
            Importar Nova
          </Button>
        </div>
      </header>

      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-4 text-emerald-800 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <div className="h-9 w-9 bg-emerald-100/50 text-emerald-600 rounded-[8px] flex items-center justify-center flex-shrink-0">
          <Info size={16} />
        </div>
        <p className="text-[13px] font-bold text-emerald-800 tracking-tight leading-snug">
          <span className="font-bold uppercase tracking-wider text-[10px] mr-2 text-emerald-700 bg-emerald-100/50 px-1.5 py-0.5 rounded">Info Importante</span>
          Toda nova importação substitui os dados anteriores. Mantenha seu arquivo mestre atualizado para garantir a integridade do rebalanceamento.
        </p>
      </div>

      {loading ? (
        <div className="py-40 flex flex-col items-center justify-center gap-6">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
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
      )}

      <Modal isOpen={modalImport} onClose={() => setModalImport(false)} title="Importar Tese de Investimentos" size="lg">
        <ImportacaoCarteira onSuccess={() => { setModalImport(false); carregarDados(); }} />
      </Modal>
    </div>
  );
};

export default CarteiraPage;
