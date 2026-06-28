
import React, { useState, useEffect } from 'react';
import { relatorioService } from '../../services/relatorioService';
import { formatarData } from '../../utils/formatadores';

interface AbaRelatoriosProps {
   clienteId: string;
   cliente: any;
}

const AbaRelatorios: React.FC<AbaRelatoriosProps> = ({ clienteId, cliente }) => {
   const [relatorios, setRelatorios] = useState<any[]>([]);
   const [envios, setEnvios] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);

   const load = async () => {
      setLoading(true);
      try {
         const [r, e] = await Promise.all([
            relatorioService.listarPorCliente(clienteId),
            relatorioService.listarEnvios(clienteId)
         ]);
         setRelatorios(r || []);
         setEnvios(e || []);
      } finally {
         setLoading(false);
      }
   };

   useEffect(() => { load(); }, [clienteId]);

   return (
      <div className="space-y-10">
         <section className="space-y-6">
            <h3 className="text-xl font-black text-main tracking-tight">Relatórios Gerados</h3>
            <div className="bg-surface border border-subtle rounded-[2rem] overflow-hidden shadow-sm">
               <table className="w-full text-left">
                  <thead>
                     <tr className="bg-surface-2 border-b border-subtle">
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-faint">Data</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-faint">Período</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-faint">Seções Incluídas</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-faint">Ações</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-subtle text-sm">
                     {loading ? (
                        <tr><td colSpan={4} className="p-10 text-center animate-pulse">Carregando histórico...</td></tr>
                     ) : relatorios.length === 0 ? (
                        <tr><td colSpan={4} className="p-10 text-center text-faint font-bold uppercase text-[10px]">Nenhum relatório gerado</td></tr>
                     ) : relatorios.map(r => (
                        <tr key={r.id} className="hover:bg-surface-2/50 transition-colors">
                           <td className="px-6 py-4 font-bold text-main">{formatarData(r.data_geracao)}</td>
                           <td className="px-6 py-4 text-muted font-bold">{r.periodo}</td>
                           <td className="px-6 py-4">
                              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">
                                 {r.secoes_incluidas?.length || 0} Seções
                              </span>
                           </td>
                           <td className="px-6 py-4 text-right">
                              <button onClick={() => relatorioService.excluirRelatorio(r.id!).then(load)} className="text-red-400 font-black text-xs uppercase hover:text-red-600">Excluir</button>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </section>

         {envios.length > 0 && (
            <section className="space-y-6">
               <h3 className="text-xl font-black text-main tracking-tight">Histórico de Envios</h3>
               <div className="bg-surface border border-subtle rounded-[2rem] overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="bg-surface-2 border-b border-subtle">
                           <th className="px-6 py-4 text-[10px] font-black uppercase text-faint">Data de Envio</th>
                           <th className="px-6 py-4 text-[10px] font-black uppercase text-faint">Destinatário</th>
                           <th className="px-6 py-4 text-[10px] font-black uppercase text-faint">Assunto</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-subtle text-sm">
                        {envios.map(e => (
                           <tr key={e.id}>
                              <td className="px-6 py-4 font-bold text-main">{formatarData(e.data_envio)}</td>
                              <td className="px-6 py-4 text-muted font-bold">{e.email_destinatario}</td>
                              <td className="px-6 py-4 text-faint italic">{e.assunto}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </section>
         )}
      </div>
   );
};

export default AbaRelatorios;
