
import React, { useState } from 'react';
import { Upload, AlertCircle, CheckCircle2, FileText, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { carteiraRecomendadaService } from '../../services/carteiraRecomendadaService';
import Button from '../UI/Button';

interface ImportacaoCarteiraProps {
  onSuccess: () => void;
}

const ImportacaoCarteira: React.FC<ImportacaoCarteiraProps> = ({ onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const processar = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        
        const res = await carteiraRecomendadaService.importarCarteira(rows);
        setResult(res);
        if (res.sucessos > 0 && res.alertas.length === 0) {
           setTimeout(onSuccess, 1500);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      alert("Erro ao ler planilha. Verifique as colunas.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {!result ? (
        <div className="space-y-8">
           <div className="p-8 bg-amber-50 border border-amber-100 rounded-[2rem] flex items-start gap-5">
              <AlertCircle className="text-amber-600 mt-1" size={24} />
              <div className="space-y-1">
                 <p className="text-sm font-black text-amber-900 uppercase">Atenção Crítica</p>
                 <p className="text-xs text-amber-700 font-medium leading-relaxed">
                   Este processo substituirá todos os ativos recomendados atuais. Certifique-se que o arquivo contém a tese completa.
                 </p>
              </div>
           </div>

           <div className="border-4 border-dashed border-slate-100 rounded-[3rem] p-16 text-center hover:border-emerald-200 hover:bg-emerald-50/20 transition-all group">
              <input type="file" id="up-carteira" className="hidden" accept=".xlsx,.csv" onChange={handleFileChange} />
              <label htmlFor="up-carteira" className="cursor-pointer block space-y-6">
                 <div className="h-20 w-20 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                    <Upload className={file ? 'text-emerald-600' : 'text-slate-200'} size={32} />
                 </div>
                 <div>
                    <p className="text-lg font-black text-slate-800 uppercase tracking-tight">
                       {file ? file.name : 'Selecionar Planilha'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Arraste ou clique para enviar</p>
                 </div>
              </label>
           </div>

           <Button 
            onClick={processar} 
            disabled={!file || loading} 
            isLoading={loading}
            className="w-full py-6 text-xs uppercase tracking-[0.2em] shadow-2xl shadow-emerald-500/10"
           >
             Confirmar e Substituir
           </Button>
        </div>
      ) : (
        <div className="space-y-8 animate-slide-up">
           <div className="text-center space-y-4">
              <div className="h-20 w-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xl">
                 <CheckCircle2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Importação Concluída</h3>
              <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                {result.sucessos} Ativos Sincronizados com Sucesso
              </p>
           </div>

           {result.alertas.length > 0 && (
             <div className="bg-rose-50 border border-rose-100 rounded-[2rem] overflow-hidden">
                <div className="p-6 bg-rose-600 text-white flex items-center gap-3">
                   <XCircle size={18} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Inconsistências Detectadas ({result.alertas.length})</span>
                </div>
                <div className="p-6 max-h-[300px] overflow-y-auto space-y-3 custom-scrollbar">
                   {result.alertas.map((msg: string, i: number) => (
                     <div key={i} className="flex items-start gap-3 text-rose-700">
                        <div className="h-1.5 w-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                        <p className="text-[10px] font-bold leading-relaxed">{msg}</p>
                     </div>
                   ))}
                </div>
                <div className="p-4 bg-rose-100/50 border-t border-rose-200">
                   <p className="text-[9px] text-rose-800 font-black uppercase text-center italic">
                     * Os itens acima foram ignorados ou não serão vinculados corretamente até que os cadastros básicos sejam feitos.
                   </p>
                </div>
             </div>
           )}

           <Button variant="outline" onClick={() => setResult(null)} className="w-full uppercase text-[10px] tracking-widest">Tentar Novamente</Button>
           <Button onClick={onSuccess} className="w-full uppercase text-[10px] tracking-widest">Finalizar e Ver Ativos</Button>
        </div>
      )}
    </div>
  );
};

export default ImportacaoCarteira;
