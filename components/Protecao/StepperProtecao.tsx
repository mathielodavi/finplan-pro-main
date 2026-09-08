
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Clock, Save } from 'lucide-react';
import { protecaoService, ClienteSeguro, DependenteSeguro, ParametrosCalculo } from '../../services/protecaoService';
import { obterClientePorId } from '../../services/clienteService';
import { useProntuarioNav } from '../../context/ProntuarioNavContext';
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

    // Espelham `dados`/`dependentes` para uso dentro do closure do submenu do header (registrado
    // num efeito que não pode depender deles sem re-registrar a cada tecla digitada).
    const dadosRef = useRef(dados);
    dadosRef.current = dados;
    const dependentesRef = useRef(dependentes);
    dependentesRef.current = dependentes;

    const saveFnDados = useCallback((d: ClienteSeguro) => protecaoService.update(clienteId, d), [clienteId]);
    const { save, saveImmediate, saving, savedAt, savedAtLabel, saveError } = useAutoSave<ClienteSeguro>({ saveFn: saveFnDados });

    const saveFnDependentes = useCallback((deps: DependenteSeguro[]) => protecaoService.salvarDependentes(
        clienteId,
        deps.map(d => ({
            ordem: d.ordem,
            nome_dependente: d.nome_dependente,
            data_nascimento_dep: d.data_nascimento_dep,
            parentesco: d.parentesco,
            cobertura_anos: d.cobertura_anos,
            auxilio_mensal: d.auxilio_mensal,
            total_calculado: d.total_calculado,
        }))
    ), [clienteId]);
    const { save: saveDependentes, saveImmediate: saveDependentesImmediate, saving: savingDeps, savedAt: savedAtDeps, saveError: saveErrorDeps } = useAutoSave<DependenteSeguro[]>({ saveFn: saveFnDependentes });

    // Indicador único de status, combinando os dois autosaves (campos do cliente + dependentes) —
    // o consultor não precisa saber que são dois mecanismos internos diferentes.
    const savingCombined = saving || savingDeps;
    const saveErrorCombined = saveError || saveErrorDeps;
    const savedAtCombined = [savedAt, savedAtDeps].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] || null;
    const savedAtLabelCombined = savedAtCombined
        ? `Salvo às ${savedAtCombined.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
        : savedAtLabel;

    const { setSubnav } = useProntuarioNav();

    // Publica as etapas (+ Resumo) como submenu no header enquanto Proteção estiver ativa
    useEffect(() => {
        setSubnav({
            items: [...ETAPAS.map(e => ({ id: String(e.id), label: e.label })), { id: 'resumo', label: 'Resumo' }],
            activeId: concluido ? 'resumo' : String(etapa),
            onSelect: (id: string) => {
                // Flush das duas frentes de autosave antes de trocar de tela pelo submenu do
                // header — mesmo motivo do `irParaEtapa`: navegar não pode deixar a última edição
                // presa só no debounce.
                saveImmediate(dadosRef.current).catch(() => {});
                saveDependentesImmediate(dependentesRef.current).catch(() => {});
                if (id === 'resumo') {
                    setConcluido(true);
                    setDados(prev => ({ ...prev, completo: true }));
                    protecaoService.update(clienteId, { completo: true }).catch(console.error);
                } else {
                    const n = Math.max(1, Math.min(5, parseInt(id)));
                    setConcluido(false);
                    setEtapa(n);
                    protecaoService.update(clienteId, { etapa_atual: n }).catch(console.error);
                }
            },
        });
        return () => setSubnav(null);
    }, [etapa, concluido, clienteId, setSubnav]);

    // ─── Carrega os dados iniciais ────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const [d, deps, params, cli] = await Promise.all([
                    protecaoService.getOrCreate(clienteId),
                    protecaoService.getDependentes(clienteId),
                    protecaoService.getParametros(),
                    obterClientePorId(clienteId).catch(() => null),
                ]);

                // Vincula identificação do titular ao cadastro do cliente (fonte única):
                // e-mail, telefone, estado e data de nascimento sempre vêm de `clientes`.
                let dadosIniciais = d;
                if (cli) {
                    const vinculo: any = {
                        email_cliente: cli.email || null,
                        telefone_cliente: cli.telefone || null,
                        estado_cliente: cli.estado || null,
                        data_nascimento_cliente: cli.data_nascimento || null,
                    };
                    dadosIniciais = { ...d, ...vinculo };
                    // Espelha no levantamento se estiver divergente, mantendo o banco vinculado.
                    const divergente = (d.email_cliente || null) !== vinculo.email_cliente
                        || (d.telefone_cliente || null) !== vinculo.telefone_cliente
                        || (d.estado_cliente || null) !== vinculo.estado_cliente
                        || (d.data_nascimento_cliente || null) !== vinculo.data_nascimento_cliente;
                    if (divergente) protecaoService.update(clienteId, vinculo).catch(console.error);
                }
                setDados(dadosIniciais);
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

    // Dependentes (etapas 2 e 3): atualiza o state local e dispara o mesmo autosave debounced
    // com retry — antes, cada Etapa chamava o Supabase diretamente a cada tecla, sem debounce,
    // sem retry e sem refletir erro no indicador de status do stepper.
    const handleChangeDependentes = useCallback((novos: DependenteSeguro[]) => {
        setDependentes(novos);
        saveDependentes(novos);
    }, [saveDependentes]);

    // ─── Navegação ───────────────────────────────────────────────────────────────
    // Flush das duas frentes de autosave antes de trocar de etapa/concluir: garante que a última
    // edição (ainda dentro da janela do debounce) esteja gravada antes de seguir em frente, em vez
    // de depender só do timer ou do flush-ao-desmontar para não perder nada.
    const irParaEtapa = async (novaEtapa: number) => {
        const clamp = Math.max(1, Math.min(5, novaEtapa));
        setEtapa(clamp);
        await Promise.allSettled([
            saveImmediate(dados),
            saveDependentesImmediate(dependentes),
            protecaoService.update(clienteId, { etapa_atual: clamp }),
        ]);
    };

    const proximo = async () => {
        if (etapa < 5) {
            irParaEtapa(etapa + 1);
        } else {
            setConcluido(true);
            await Promise.allSettled([
                saveImmediate({ ...dados, completo: true }),
                saveDependentesImmediate(dependentes),
            ]);
            setDados(prev => ({ ...prev, completo: true }));
        }
    };

    const voltar = () => {
        if (concluido) { setConcluido(false); return; }
        if (etapa > 1) irParaEtapa(etapa - 1);
    };

    // Completude por etapa (baseada em dados preenchidos, não na posição atual)
    const temDados = (id: number): boolean => {
        switch (id) {
            case 1: return !!dados.data_nascimento_cliente || !!dados.cpf_cliente || !!dados.profissao_cliente;
            case 2: return dependentes.some(d => d.nome_dependente?.trim());
            case 3: return dependentes.some(d => (d.auxilio_mensal || 0) > 0 || (d.total_calculado || 0) > 0);
            case 4: return (dados.renda_cliente || 0) > 0 || (dados.despesas_obrigatorias || 0) > 0;
            case 5: return (dados.bens_cliente || 0) > 0 || (dados.funeral_cliente || 0) > 0 || (dados.investimentos_cliente || 0) > 0;
            default: return false;
        }
    };

    // ─── Loading ─────────────────────────────────────────────────────────────────
    if (loading) return (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[color:var(--primary)]" />
            <p className="text-faint text-xs font-bold uppercase tracking-widest">Carregando levantamento...</p>
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
                        const preenchida = temDados(e.id);
                        return (
                            <React.Fragment key={e.id}>
                                <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                                    <button
                                        onClick={() => irParaEtapa(e.id)}
                                        title={preenchida ? 'Preenchida' : 'Pendente'}
                                        className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-[13px] border-2 transition-all ${ativa ? 'ring-2 ring-[color:var(--primary-soft)]' : ''} ${preenchida ? 'bg-[color:var(--primary)] border-[color:var(--primary)] text-white' :
                                            ativa ? 'bg-surface border-[color:var(--primary)] text-[color:var(--primary)] shadow-sm' :
                                                'bg-surface border-subtle text-faint'
                                            }`}
                                    >
                                        {preenchida ? <Check size={14} strokeWidth={3} /> : e.id}
                                    </button>
                                    <span className={`text-center text-[10px] font-semibold uppercase tracking-widest leading-tight truncate max-w-full px-1 mt-1 ${ativa ? 'text-[color:var(--primary)]' : preenchida ? 'text-[color:var(--primary)]' : 'text-[color:var(--text-muted)]'
                                        }`}>
                                        {e.label}
                                    </span>
                                </div>
                                {i < ETAPAS.length - 1 && (
                                    <div className={`flex-1 h-0.5 mb-6 max-w-[60px] transition-colors ${preenchida ? 'bg-[color:var(--primary)]' : 'bg-surface-3'}`} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            )}

            {/* ── Status de salvamento ────────────────────────────────────────────── */}
            <div className="flex items-center gap-2 h-4">
                {savingCombined && (
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[color:var(--primary)] uppercase tracking-widest">
                        <Clock size={11} className="animate-spin" />
                        Salvando...
                    </span>
                )}
                {!savingCombined && savedAtLabelCombined && !saveErrorCombined && (
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[color:var(--primary)] uppercase tracking-widest">
                        <Save size={11} />
                        {savedAtLabelCombined}
                    </span>
                )}
                {saveErrorCombined && (
                    <span className="text-[10px] font-semibold text-[color:var(--danger)] uppercase tracking-widest">{saveErrorCombined}</span>
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
                            onChange={handleChangeDependentes}
                        />
                    )}
                    {etapa === 3 && (
                        <EtapaEducacao
                            dependentes={dependentes}
                            onChange={handleChangeDependentes}
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
                    <div className="flex justify-between pt-6 border-t border-[color:var(--border)]">
                        <button
                            onClick={voltar}
                            disabled={etapa === 1}
                            className="px-5 h-[40px] flex items-center justify-center rounded-lg border border-subtle text-[color:var(--text-muted)] font-semibold text-[11px] uppercase tracking-widest hover:bg-surface-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            ← Voltar
                        </button>
                        <button
                            onClick={proximo}
                            className="px-6 h-[40px] flex items-center justify-center rounded-lg bg-[color:var(--primary)] text-white font-bold text-[11px] uppercase tracking-widest hover:opacity-90 transition-all shadow-sm"
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
