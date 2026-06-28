
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
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              file ? 'border-indigo-500 bg-indigo-50/30' : 'border-subtle hover:border-indigo-200'
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
              <div className="h-16 w-16 bg-surface rounded-xl shadow-sm border border-subtle flex items-center justify-center mx-auto">
                <Upload className={file ? 'text-indigo-600' : 'text-faint'} size={24} />
              </div>
              <div>
                <p className="text-[14px] font-bold text-main uppercase tracking-tight">
                  {file ? file.name : 'Arraste o arquivo ou clique aqui'}
                </p>
                <p className="text-[10px] text-faint font-bold uppercase mt-1 tracking-wider">
                  Suporta extratos B3, XP, BTG (CSV/XLSX)
                </p>
              </div>
            </label>
          </div>

          <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
             <AlertCircle className="text-amber-500 shrink-0" size={16} />
             <p className="text-[10px] text-amber-700 font-bold leading-relaxed uppercase tracking-wider">
               A importação substituirá ou adicionará novos ativos à carteira atual. Certifique-se de validar os dados após o processamento.
             </p>
          </div>

          <button
            onClick={handleImport}
            disabled={!file || loading}
            className="w-full h-9 bg-indigo-600 text-white font-bold rounded-[8px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 uppercase text-[10px] tracking-wider hover:bg-indigo-700"
          >
            {loading ? 'Processando Inteligência...' : 'Iniciar Importação'}
            {!loading && <FileText size={16} />}
          </button>
        </div>
      ) : (
        <div className="py-12 text-center space-y-4 animate-in zoom-in-95 duration-500">
           <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto shadow-sm border border-emerald-100">
              <CheckCircle2 size={32} strokeWidth={2.5} />
           </div>
           <h3 className="text-[20px] font-bold text-main uppercase tracking-tight">Custódia Sincronizada!</h3>
           <p className="text-muted font-bold uppercase text-[10px] tracking-wider">Atualizando dashboard de ativos...</p>
        </div>
      )}
    </div>
  );
};

export default ImportacaoAtivos;
