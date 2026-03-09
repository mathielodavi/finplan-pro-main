
import React, { useState, useEffect, useCallback } from 'react';
import { Check, Clock, Save } from 'lucide-react';
import { protecaoService, ClienteSeguro, DependenteSeguro, ParametrosCalculo } from '../../services/protecaoService';
import { useAutoSave } from './useAutoSave';
import EtapaDadosPessoais from './EtapaDadosPessoais';
import EtapaDependentes from './EtapaDependentes';
import EtapaEducacao from './EtapaEducacao';
import EtapaPadraoVida from './EtapaPadraoVida';
import EtapaSucessao from './EtapaSucessao';
import DashboardProtecao from './DashboardProtecao';

interface StepperProtecaoProps {
    clienteId: string;
    nomeCliente?: string;
}

const ETAPAS = [
    { id: 1, label: 'Dados Pessoais' },
    { id: 2, label: 'Dependentes' },
    { id: 3, label: 'Educação' },
    { id: 4, label: 'Padrão de Vida' },
    { id: 5, label: 'Sucessão' },
];

const StepperProtecao: React.FC<StepperProtecaoProps> = ({ clienteId, nomeCliente }) => {
    const [etapa, setEtapa] = useState(1);
    const [dados, setDados] = useState<ClienteSeguro>({ cliente_id: clienteId });
    const [dependentes, setDependentes] = useState<DependenteSeguro[]>([]);
    const [parametros, setParametros] = useState<ParametrosCalculo>({
        taxa_juros_aa: 6.25,
        ipca_projetado_aa: 4.50,
        perc_custos_inventario: 20,
    });
    const [loading, setLoading] = useState(true);
    const [concluido, setConcluido] = useState(false);

    const { save, saving, savedAtLabel, saveError } = useAutoSave({ clienteId });

    // ─── Carrega os dados iniciais ────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const [d, deps, params] = await Promise.all([
                    protecaoService.getOrCreate(clienteId),
                    protecaoService.getDependentes(clienteId),
                    protecaoService.getParametros(),
                ]);
                setDados(d);
                setDependentes(deps.length > 0 ? deps : [{
                    cliente_id: clienteId,
                    ordem: 0,
                    nome_dependente: '',
                    parentesco: 'Filho(a)',
                    cobertura_anos: 10,
                    auxilio_mensal: 0,
                }]);
                setParametros(params);
                if (d.etapa_atual) setEtapa(d.etapa_atual > 5 ? 5 : d.etapa_atual);

                // Exibe o dashboard se já marcou completo ou se é um cliente legado
                // que já havia preenchido até a etapa 5
                if (d.completo || (d.etapa_atual === 5 && d.funeral_cliente !== undefined)) {
                    setConcluido(true);
                }
            } catch (err) {
                console.error('[StepperProtecao] Erro ao carregar:', err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [clienteId]);

    // ─── Atualiza campo e dispara autosave ───────────────────────────────────────
    const handleChange = useCallback((campo: keyof ClienteSeguro, valor: any) => {
        const novosDados = { ...dados, [campo]: valor };
        setDados(novosDados);
        save(novosDados);
    }, [dados, save]);

    const handleChangeMultiple = useCallback((novos: Partial<ClienteSeguro>) => {
        const novosDados = { ...dados, ...novos };
        setDados(novosDados);
        save(novosDados);
    }, [dados, save]);

    // ─── Navegação ───────────────────────────────────────────────────────────────
    const irParaEtapa = async (novaEtapa: number) => {
        const clamp = Math.max(1, Math.min(5, novaEtapa));
        setEtapa(clamp);
        await protecaoService.update(clienteId, { etapa_atual: clamp });
    };

    const proximo = async () => {
        if (etapa < 5) {
            irParaEtapa(etapa + 1);
        } else {
            setConcluido(true);
            await protecaoService.update(clienteId, { completo: true });
            setDados(prev => ({ ...prev, completo: true }));
        }
    };

    const voltar = () => {
        if (concluido) { setConcluido(false); return; }
        if (etapa > 1) irParaEtapa(etapa - 1);
    };

    // ─── Loading ─────────────────────────────────────────────────────────────────
    if (loading) return (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Carregando levantamento...</p>
        </div>
    );

    // ─── Render ──────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* ── Stepper Visual ─────────────────────────────────────────────────── */}
            {!concluido && (
                <div className="flex items-center gap-0">
                    {ETAPAS.map((e, i) => {
                        const ativa = e.id === etapa;
                        const concl = e.id < etapa;
                        return (
                            <React.Fragment key={e.id}>
                                <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                                    <button
                                        onClick={() => irParaEtapa(e.id)}
                                        className={`h-8 w-8 rounded-full flex items-center justify-center font-black text-xs border-2 transition-all ${concl ? 'bg-emerald-600 border-emerald-600 text-white' :
                                            ativa ? 'bg-white border-emerald-600 text-emerald-600 shadow-lg shadow-emerald-100' :
                                                'bg-white border-slate-200 text-slate-400'
                                            }`}
                                    >
                                        {concl ? <Check size={14} strokeWidth={3} /> : e.id}
                                    </button>
                                    <span className={`text-center text-[8px] font-black uppercase tracking-widest leading-tight truncate max-w-full px-1 ${ativa ? 'text-emerald-600' : concl ? 'text-emerald-400' : 'text-slate-300'
                                        }`}>
                                        {e.label}
                                    </span>
                                </div>
                                {i < ETAPAS.length - 1 && (
                                    <div className={`flex-1 h-0.5 mb-5 max-w-[60px] transition-colors ${concl ? 'bg-emerald-400' : 'bg-slate-100'}`} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            )}

            {/* ── Status de salvamento ────────────────────────────────────────────── */}
            <div className="flex items-center gap-2 h-4">
                {saving && (
                    <span className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-500 uppercase tracking-widest">
                        <Clock size={11} className="animate-spin" />
                        Salvando...
                    </span>
                )}
                {!saving && savedAtLabel && (
                    <span className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-500 uppercase tracking-widest">
                        <Save size={11} />
                        {savedAtLabel}
                    </span>
                )}
                {saveError && (
                    <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest">{saveError}</span>
                )}
            </div>

            {/* ── Conteúdo da Etapa ──────────────────────────────────────────────── */}
            {concluido ? (
                <DashboardProtecao
                    dados={dados}
                    dependentes={dependentes}
                    parametros={parametros}
                    nomeCliente={nomeCliente}
                    onEditar={voltar}
                />
            ) : (
                <>
                    {etapa === 1 && (
                        <EtapaDadosPessoais
                            dados={dados}
                            onChange={handleChange}
                            onChangeMultiple={handleChangeMultiple}
                        />
                    )}
                    {etapa === 2 && (
                        <EtapaDependentes
                            clienteId={clienteId}
                            dependentes={dependentes}
                            onChange={setDependentes}
                        />
                    )}
                    {etapa === 3 && (
                        <EtapaEducacao
                            dependentes={dependentes}
                            onChange={setDependentes}
                            parametros={parametros}
                        />
                    )}
                    {etapa === 4 && (
                        <EtapaPadraoVida
                            dados={dados}
                            onChange={handleChange}
                            onChangeMultiple={handleChangeMultiple}
                            parametros={parametros}
                        />
                    )}
                    {etapa === 5 && (
                        <EtapaSucessao
                            dados={dados}
                            onChange={handleChange}
                            parametros={parametros}
                        />
                    )}

                    {/* ── Navegação ──────────────────────────────────────────────────── */}
                    <div className="flex justify-between pt-6 border-t border-slate-100">
                        <button
                            onClick={voltar}
                            disabled={etapa === 1}
                            className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            ← Voltar
                        </button>
                        <button
                            onClick={proximo}
                            className="px-8 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200"
                        >
                            {etapa === 5 ? 'Ver Resumo →' : 'Próximo →'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default StepperProtecao;
