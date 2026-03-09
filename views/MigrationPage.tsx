
import React, { useState } from 'react';
import { migrationService, MigrationPayload } from '../services/migrationService';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import { Upload, Download, Database, CheckCircle2, AlertTriangle, ChevronRight, FileJson, ArrowRight } from 'lucide-react';

const MigrationPage: React.FC = () => {
  const [step, setStep] = useState(1);
  const [payload, setPayload] = useState<MigrationPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownloadTemplate = () => {
    const data = migrationService.getTemplate();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo-vibe-financeiro.json';
    link.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (!json.clientes || !json.contratos) throw new Error("Estrutura JSON inválida. Use o modelo.");
        setPayload(json);
        setStep(2);
        setError(null);
      } catch (err: any) {
        setError("Erro ao ler arquivo: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const execute = async () => {
    if (!payload) return;
    setLoading(true);
    try {
      const res = await migrationService.executeMigration(payload, {});
      setResult(res);
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-fade-in pb-20">
      <header className="flex justify-between items-center border-b border-slate-100 pb-8">
        <div>
           <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-none uppercase">Motor de Migração</h1>
           <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-2">Importe dados do Lovable para o Vibe Financeiro Pro</p>
        </div>
        <div className="h-14 w-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
           <Database size={28} />
        </div>
      </header>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-4">
        {[1, 2, 3].map(i => (
          <React.Fragment key={i}>
            <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-black text-xs transition-all ${step >= i ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
               {step > i ? <CheckCircle2 size={16} /> : i}
            </div>
            {i < 3 && <div className={`h-1 w-12 rounded-full ${step > i ? 'bg-indigo-600' : 'bg-slate-100'}`} />}
          </React.Fragment>
        ))}
      </div>

      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-slide-up">
           <Card className="hover:border-indigo-200 transition-all group">
              <div className="space-y-6">
                 <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><Download size={24} /></div>
                 <div>
                    <h3 className="font-black text-slate-800 uppercase text-sm mb-2">1. Preparar Arquivo</h3>
                    <p className="text-slate-500 text-xs font-medium leading-relaxed">Baixe o modelo JSON e use como base para pedir ao Lovable exportar seu banco de dados atual.</p>
                 </div>
                 <button onClick={handleDownloadTemplate} className="w-full py-4 bg-slate-50 hover:bg-slate-100 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-600 transition-all">Baixar Modelo JSON</button>
              </div>
           </Card>

           <Card className="hover:border-emerald-200 transition-all group">
              <div className="space-y-6">
                 <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><Upload size={24} /></div>
                 <div>
                    <h3 className="font-black text-slate-800 uppercase text-sm mb-2">2. Enviar Dados</h3>
                    <p className="text-slate-500 text-xs font-medium leading-relaxed">Selecione o arquivo gerado pelo sistema anterior para iniciar a validação de estrutura.</p>
                 </div>
                 <label className="cursor-pointer block">
                    <div className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white text-center shadow-xl shadow-indigo-100 transition-all">Selecionar Arquivo</div>
                    <input type="file" className="hidden" accept=".json" onChange={handleFileUpload} />
                 </label>
              </div>
           </Card>
        </div>
      )}

      {step === 2 && payload && (
        <div className="space-y-8 animate-slide-up">
           <Card title="Sumário de Importação" subtitle="Validação de dados detectada">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 {[
                   { label: 'Clientes', count: payload.clientes.length, color: 'blue' },
                   { label: 'Reuniões', count: payload.reunioes.length, color: 'green' },
                   { label: 'Contratos', count: payload.contratos.length, color: 'amber' },
                   { label: 'Parcelas', count: payload.financeiro_parcelas.length, color: 'purple' }
                 ].map(item => (
                   <div key={item.label} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                      <p className="text-2xl font-black text-slate-900">{item.count}</p>
                   </div>
                 ))}
              </div>
              <div className="mt-8 p-6 bg-blue-50 border border-blue-100 rounded-3xl flex items-start gap-4">
                 <AlertTriangle className="text-blue-600 shrink-0" size={20} />
                 <div className="space-y-1">
                    <p className="text-[10px] font-black text-blue-800 uppercase">Regra de Batimento</p>
                    <p className="text-xs text-blue-700 leading-relaxed font-medium">
                      O sistema vinculará todos os dados importados ao seu usuário atual. 
                      Os IDs originais serão preservados em um campo de auditoria para garantir que as relações (Contrato → Cliente) continuem coerentes.
                    </p>
                 </div>
              </div>
           </Card>

           <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep(1)} className="flex-1 py-5 text-xs uppercase tracking-widest">Voltar</Button>
              <Button 
                onClick={execute} 
                isLoading={loading} 
                className="flex-1 py-5 text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-100"
                leftIcon={<ArrowRight size={18} />}
              >
                Executar Migração
              </Button>
           </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="text-center py-20 space-y-10 animate-slide-up">
           <div className="inline-flex h-24 w-24 bg-emerald-50 text-emerald-600 rounded-[2.5rem] items-center justify-center shadow-xl">
              <CheckCircle2 size={48} strokeWidth={2.5} />
           </div>
           <div className="space-y-4">
              <h2 className="text-3xl font-black text-slate-900 uppercase">Sucesso Absoluto!</h2>
              <p className="text-slate-500 font-medium max-w-sm mx-auto italic">O banco de dados do Lovable foi portado para a nova infraestrutura Tulipa Vibe.</p>
           </div>
           
           <div className="max-w-md mx-auto grid grid-cols-2 gap-4">
              <div className="p-5 bg-white border border-slate-100 rounded-3xl">
                 <p className="text-[9px] font-black text-slate-400 uppercase">Clientes</p>
                 <p className="text-xl font-black text-slate-800">+{result.clientes}</p>
              </div>
              <div className="p-5 bg-white border border-slate-100 rounded-3xl">
                 <p className="text-[9px] font-black text-slate-400 uppercase">Contratos</p>
                 <p className="text-xl font-black text-slate-800">+{result.contratos}</p>
              </div>
           </div>

           <Button onClick={() => window.location.hash = '/clientes'} variant="primary" className="px-12 py-5 text-xs uppercase tracking-widest">Ver Carteira Atualizada</Button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 text-rose-700 rounded-2xl border border-rose-100 text-xs font-bold animate-shake">
           ⚠ {error}
        </div>
      )}
    </div>
  );
};

export default MigrationPage;
