
import React, { useState } from 'react';
import Modal from '../Modal';
import { relatorioService } from '../../services/relatorioService';
import { Relatorio } from '../../types/relatorio';

interface ModalEnviarRelatorioProps {
  isOpen: boolean;
  onClose: () => void;
  relatorio: Relatorio;
  cliente: any;
}

const ModalEnviarRelatorio: React.FC<ModalEnviarRelatorioProps> = ({ isOpen, onClose, relatorio, cliente }) => {
  const [email, setEmail] = useState(cliente.email || '');
  const [assunto, setAssunto] = useState(`Seu Relatório de Planejamento Financeiro - ${relatorio.periodo}`);
  const [mensagem, setMensagem] = useState(`Olá ${cliente.nome.split(' ')[0]},\n\nSegue em anexo o relatório detalhado do seu planejamento financeiro referente ao período de ${relatorio.periodo}.\n\nQualquer dúvida, estou à disposição.\n\nAtenciosamente,\nSeu Consultor Vibe.`);
  const [enviando, setEnviando] = useState(false);

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await relatorioService.enviarPorEmail(relatorio, email, assunto, mensagem);
      await relatorioService.registrarEnvio({
        relatorio_id: relatorio.id,
        email_destinatario: email,
        data_envio: new Date().toISOString(),
        assunto
      });
      alert('E-mail enviado com sucesso!');
      onClose();
    } catch (err) {
      alert('Erro ao enviar e-mail.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enviar por E-mail">
      <form onSubmit={handleEnviar} className="space-y-5">
        <div>
           <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">E-mail do Cliente</label>
           <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold" />
        </div>
        <div>
           <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Assunto</label>
           <input type="text" required value={assunto} onChange={e => setAssunto(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold" />
        </div>
        <div>
           <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Mensagem</label>
           <textarea rows={5} value={mensagem} onChange={e => setMensagem(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm" />
        </div>
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3">
           <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
           <span className="text-[10px] font-black text-blue-700 uppercase">O PDF gerado será enviado como anexo.</span>
        </div>
        <div className="flex gap-3 pt-2">
           <button type="button" onClick={onClose} className="flex-1 py-4 font-black text-slate-500 uppercase text-xs border border-slate-100 rounded-xl">Cancelar</button>
           <button type="submit" disabled={enviando} className="flex-1 py-4 font-black text-white uppercase text-xs bg-blue-600 rounded-xl shadow-lg">
             {enviando ? 'Enviando...' : 'Enviar Agora'}
           </button>
        </div>
      </form>
    </Modal>
  );
};

export default ModalEnviarRelatorio;
