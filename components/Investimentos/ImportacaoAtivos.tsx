
import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { importacaoService } from '../../services/importacaoService';

interface ImportacaoAtivosProps {
  clienteId: string;
  onSuccess: () => void;
}

const ImportacaoAtivos: React.FC<ImportacaoAtivosProps> = ({ clienteId, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setSuccess(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      await importacaoService.processarArquivoCustodia(clienteId, file);
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      alert('Erro ao processar arquivo. Verifique o formato.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {!success ? (
        <div className="space-y-6">
          <div 
            className={`border-4 border-dashed rounded-[2rem] p-12 text-center transition-all ${
              file ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-100 hover:border-indigo-200'
            }`}
          >
            <input 
              type="file" 
              id="file-upload" 
              className="hidden" 
              accept=".csv,.xlsx" 
              onChange={handleFileChange}
            />
            <label htmlFor="file-upload" className="cursor-pointer space-y-4 block">
              <div className="h-20 w-20 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto">
                <Upload className={file ? 'text-indigo-600' : 'text-slate-300'} size={32} />
              </div>
              <div>
                <p className="text-sm font-black text-slate-800 uppercase tracking-tight">
                  {file ? file.name : 'Arraste o arquivo ou clique aqui'}
                </p>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">
                  Suporta extratos B3, XP, BTG (CSV/XLSX)
                </p>
              </div>
            </label>
          </div>

          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-3">
             <AlertCircle className="text-amber-500 shrink-0" size={18} />
             <p className="text-[10px] text-amber-700 font-bold leading-relaxed uppercase">
               A importação substituirá ou adicionará novos ativos à carteira atual. Certifique-se de validar os dados após o processamento.
             </p>
          </div>

          <button
            onClick={handleImport}
            disabled={!file || loading}
            className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 disabled:opacity-50 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
          >
            {loading ? 'Processando Inteligência...' : 'Iniciar Importação'}
            {!loading && <FileText size={18} />}
          </button>
        </div>
      ) : (
        <div className="py-12 text-center space-y-4 animate-in zoom-in-95 duration-500">
           <div className="h-20 w-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-100">
              <CheckCircle2 size={40} strokeWidth={2.5} />
           </div>
           <h3 className="text-xl font-black text-slate-900 uppercase">Custódia Sincronizada!</h3>
           <p className="text-slate-500 font-medium italic text-sm">Atualizando dashboard de ativos...</p>
        </div>
      )}
    </div>
  );
};

export default ImportacaoAtivos;
