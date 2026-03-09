
import React, { useState } from 'react';
import Modal from '../Modal';
import { gerarPDFRelatorio } from '../../utils/pdfGenerator';
import { relatorioService } from '../../services/relatorioService';

const SECOES_OPCOES = [
  { id: 'resumo', label: 'Resumo Executivo' },
  { id: 'cliente', label: 'Informações do Cliente' },
  { id: 'contratos', label: 'Contratos Ativos' },
  { id: 'ativos', label: 'Carteira de Ativos' },
  { id: 'projetos', label: 'Projetos (Metas)' },
  { id: 'independencia', label: 'Independência Financeira' },
  { id: 'rebalanceamento', label: 'Histórico de Rebalanceamento' },
  { id: 'reunioes', label: 'Histórico de Reuniões' },
  { id: 'analise', label: 'Análise e Recomendações' },
];

interface ModalGerarRelatorioProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: any;
  contratos: any[];
  ativos: any[];
  projetos: any[];
  reunioes: any[];
  onGenerated: () => void;
}

const ModalGerarRelatorio: React.FC<ModalGerarRelatorioProps> = ({ 
  isOpen, onClose, cliente, contratos, ativos, projetos, reunioes, onGenerated 
}) => {
  const [secoes, setSecoes] = useState<string[]>(['resumo', 'cliente', 'contratos', 'ativos', 'projetos']);
  const [periodo, setPeriodo] = useState('Janeiro 2026');
  const [gerando, setGerando] = useState(false);

  const handleToggleSecao = (id: string) => {
    setSecoes(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleGerar = async () => {
    setGerando(true);
    try {
      const doc = await gerarPDFRelatorio({
        cliente, contratos, ativos, projetos, reunioes, secoes, periodo
      });
      
      // Salvar registro no banco
      await relatorioService.salvarRelatorio({
        cliente_id: cliente.id,
        periodo,
        secoes_incluidas: secoes,
        data_geracao: new Date().toISOString()
      });

      doc.save(`Relatorio-${cliente.nome.replace(/\s+/g, '-')}-${periodo.replace(/\s+/g, '-')}.pdf`);
      onGenerated();
      onClose();
    } catch (err) {
      alert('Erro ao gerar relatório');
    } finally {
      setGerando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configurar Relatório">
      <div className="space-y-6">
        <div>
           <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Período de Referência</label>
           <input 
             type="text" 
             value={periodo} 
             onChange={e => setPeriodo(e.target.value)}
             className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" 
             placeholder="Ex: Janeiro 2026"
           />
        </div>

        <div className="space-y-3">
           <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Seções a Incluir</h4>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SECOES_OPCOES.map(opt => (
                <label key={opt.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                   <input 
                    type="checkbox" 
                    checked={secoes.includes(opt.id)} 
                    onChange={() => handleToggleSecao(opt.id)}
                    className="h-5 w-5 rounded-lg text-blue-600 border-slate-200"
                   />
                   <span className="text-xs font-bold text-slate-700">{opt.label}</span>
                </label>
              ))}
           </div>
        </div>

        <div className="flex gap-3 pt-4">
           <button type="button" onClick={onClose} className="flex-1 py-4 font-black text-slate-500 uppercase text-xs border border-slate-100 rounded-xl">Cancelar</button>
           <button 
            type="button" 
            onClick={handleGerar} 
            disabled={gerando || secoes.length === 0}
            className="flex-1 py-4 font-black text-white uppercase text-xs bg-blue-600 rounded-xl shadow-lg disabled:opacity-50"
           >
              {gerando ? 'Gerando PDF...' : 'Gerar e Baixar'}
           </button>
        </div>
      </div>
    </Modal>
  );
};

export default ModalGerarRelatorio;
