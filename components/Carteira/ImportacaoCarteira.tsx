
import React, { useState } from 'react';
import { Upload, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
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
           <div className="p-4 bg-warning/10 border border-subtle rounded-xl flex items-start gap-3">
              <AlertCircle className="text-warning shrink-0" size={20} />
              <div className="space-y-1">
                 <p className="text-[10px] font-bold text-warning uppercase tracking-wider">Atenção Crítica</p>
                 <p className="text-[12px] text-main font-bold leading-snug">
                   Este processo substituirá todos os ativos recomendados atuais. Certifique-se que o arquivo contém a tese completa.
                 </p>
              </div>
           </div>

           <div className="border border-dashed border-subtle bg-surface-2/50 rounded-xl p-12 text-center hover:border-primary hover:bg-primary/5 transition-all group">
              <input type="file" id="up-carteira" className="hidden" accept=".xlsx,.csv" onChange={handleFileChange} />
              <label htmlFor="up-carteira" className="cursor-pointer block space-y-4">
                 <div className="h-14 w-14 bg-surface rounded-xl border border-subtle flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                    <Upload className={file ? 'text-primary' : 'text-faint'} size={24} />
                 </div>
                 <div>
                    <p className="text-[14px] font-bold text-main uppercase tracking-tighter">
                       {file ? file.name : 'Selecionar Planilha'}
                    </p>
                    <p className="text-[10px] text-faint font-bold uppercase mt-1 tracking-wider">Arraste ou clique para enviar</p>
                 </div>
              </label>
           </div>

           <Button
            onClick={processar}
            disabled={!file || loading}
            isLoading={loading}
            className="w-full h-9 text-[10px] uppercase tracking-wider rounded-[8px] font-bold"
           >
             Confirmar e Substituir
           </Button>
        </div>
      ) : (
        <div className="space-y-6 animate-slide-up">
           <div className="text-center space-y-3">
              <div className="h-14 w-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
                 <CheckCircle2 size={28} />
              </div>
              <h3 className="text-[18px] font-bold text-main uppercase tracking-tighter">Importação Concluída</h3>
              <p className="text-faint font-bold uppercase text-[10px] tracking-wider">
                {result.sucessos} Ativos Sincronizados com Sucesso
              </p>
           </div>

           {result.alertas.length > 0 && (
             <div className="bg-surface-2 border border-subtle rounded-xl overflow-hidden">
                <div className="p-3 bg-danger/15 text-danger flex items-center gap-2 border-b border-subtle">
                   <XCircle size={16} />
                   <span className="text-[10px] font-bold uppercase tracking-wider">Inconsistências Detectadas ({result.alertas.length})</span>
                </div>
                <div className="p-5 max-h-[300px] overflow-y-auto space-y-3 custom-scrollbar">
                   {result.alertas.map((msg: string, i: number) => (
                     <div key={i} className="flex items-start gap-3 text-muted">
                        <div className="h-1.5 w-1.5 rounded-full bg-danger mt-1.5 shrink-0" />
                        <p className="text-[12px] font-medium leading-relaxed">{msg}</p>
                     </div>
                   ))}
                </div>
                <div className="p-3 bg-surface border-t border-subtle">
                   <p className="text-[10px] text-faint font-bold uppercase text-center">
                     * Os itens acima foram ignorados ou não serão vinculados corretamente até que os cadastros básicos sejam feitos.
                   </p>
                </div>
             </div>
           )}

           <div className="flex gap-3">
              <Button variant="outline" onClick={() => setResult(null)} className="flex-1 h-9 uppercase text-[10px] tracking-wider rounded-[8px] font-bold">Tentar Novamente</Button>
              <Button onClick={onSuccess} className="flex-1 h-9 uppercase text-[10px] tracking-wider rounded-[8px] font-bold">Finalizar e Ver Ativos</Button>
           </div>
        </div>
      )}
    </div>
  );
};

export default ImportacaoCarteira;
