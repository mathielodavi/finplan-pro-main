
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Check, Clock, Save } from 'lucide-react';
import { protecaoService, ClienteSeguro, DependenteSeguro, ParametrosCalculo } from '../../services/protecaoService';
import { obterClientePorId } from '../../services/clienteService';
import { Familiar, PARENTESCO_CONJUGE, familiaService, identidadeDoConjuge, membroDoFamiliar } from '../../services/familiaService';
import { useProntuarioNav } from '../../context/ProntuarioNavContext';
import { useAutoSave } from './useAutoSave';
import EtapaDadosPessoais from './EtapaDadosPessoais';
import EtapaEducacao from './EtapaEducacao';
import EtapaPadraoVida from './EtapaPadraoVida';
import EtapaSucessao from './EtapaSucessao';
import DashboardProtecao from './DashboardProtecao';

interface StepperProtecaoProps {
    clienteId: string;
    nomeCliente?: string;
}

const ETAPAS = [
    { id: 1, label: 'Saúde e Hábitos' },
    { id: 2, label: 'Educação' },
    { id: 3, label: 'Padrão de Vida' },
    { id: 4, label: 'Sucessão' },
];

const ULTIMA_ETAPA = ETAPAS.length;
const VISAO_FAMILIA = 'familia';
const primeiroNome = (nome?: string) => nome?.trim().split(/\s+/)[0] || '';

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
    // O painel é a tela da aba; o wizard só abre pelo botão Editar levantamento.
    const [editando, setEditando] = useState(false);
    const [familiares, setFamiliares] = useState<Familiar[]>([]);
    const [visao, setVisao] = useState(VISAO_FAMILIA);

    // Espelham `dados`/`dependentes` para uso dentro do closure do submenu do header (registrado
    // num efeito que não pode depender deles sem re-registrar a cada tecla digitada).
    const dadosRef = useRef(dados);
    dadosRef.current = dados;
    const dependentesRef = useRef(dependentes);
    dependentesRef.current = dependentes;

    const saveFnDados = useCallback((d: ClienteSeguro) => protecaoService.update(clienteId, d), [clienteId]);
    const { save, saveImmediate, saving, savedAt, savedAtLabel, saveError } = useAutoSave<ClienteSeguro>({ saveFn: saveFnDados });

    const saveFnDependentes = useCallback((deps: DependenteSeguro[]) => protecaoService.salvarDependentes(deps), []);
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

    const membros = useMemo(() => [
        { chave: 'cliente', nome: nomeCliente || 'Titular' },
        ...familiares.map(f => ({ chave: membroDoFamiliar(f), nome: f.nome })),
    ], [nomeCliente, familiares]);

    // Grava o que está no debounce antes de trocar de tela: navegar não pode perder a última
    // edição. Fica em ref para o submenu do header não ser registrado de novo a cada render.
    const descarregarEdicoes = () => Promise.allSettled([
        saveImmediate(dadosRef.current),
        saveDependentesImmediate(dependentesRef.current),
    ]);
    const descarregarRef = useRef(descarregarEdicoes);
    descarregarRef.current = descarregarEdicoes;

    // Submenu do header: família e cada familiar no painel; etapas no wizard.
    useEffect(() => {
        setSubnav(editando
            ? {
                items: [...ETAPAS.map(e => ({ id: String(e.id), label: e.label })), { id: 'painel', label: 'Painel' }],
                activeId: String(etapa),
                onSelect: (id: string) => {
                    descarregarRef.current();
                    if (id === 'painel') setEditando(false);
                    else setEtapa(Math.max(1, Math.min(ULTIMA_ETAPA, parseInt(id))));
                },
            }
            : {
                items: [
                    { id: VISAO_FAMILIA, label: 'Família' },
                    ...membros.map(m => ({ id: m.chave, label: primeiroNome(m.nome) || m.nome })),
                ],
                activeId: visao,
                onSelect: setVisao,
            });
        return () => setSubnav(null);
    }, [editando, etapa, visao, membros, setSubnav]);

    // ─── Carrega os dados iniciais ────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const [d, deps, params, cli, membrosFamilia] = await Promise.all([
                    protecaoService.getOrCreate(clienteId),
                    protecaoService.getDependentes(clienteId),
                    protecaoService.getParametros(),
                    obterClientePorId(clienteId).catch(() => null),
                    familiaService.listar(clienteId),
                ]);

                // Identificação vem do cadastro (cliente + família), fonte única. O levantamento
                // guarda um espelho, lido pelos cálculos, pelo score e pelo PDF.
                let dadosIniciais = d;
                if (cli) {
                    const conjuge = membrosFamilia.find(f => f.parentesco === PARENTESCO_CONJUGE);
                    const vinculo: Record<string, any> = {
                        nome_cliente: cli.nome || null,
                        email_cliente: cli.email || null,
                        telefone_cliente: cli.telefone || null,
                        estado_cliente: cli.estado || null,
                        data_nascimento_cliente: cli.data_nascimento || null,
                        cpf_cliente: cli.cpf || null,
                        profissao_cliente: cli.profissao || null,
                        ...(conjuge ? identidadeDoConjuge(conjuge) : { casado_cliente: false }),
                    };
                    dadosIniciais = { ...d, ...vinculo };
                    // Espelha no levantamento se estiver divergente, mantendo o banco vinculado.
                    const divergente = Object.keys(vinculo).some(k => ((d as any)[k] ?? null) !== (vinculo[k] ?? null));
                    if (divergente) protecaoService.update(clienteId, vinculo as Partial<ClienteSeguro>).catch(console.error);
                }
                setDados(dadosIniciais);
                setDependentes(deps);
                setParametros(params);
                setFamiliares(membrosFamilia);
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
    const irParaEtapa = async (novaEtapa: number) => {
        setEtapa(Math.max(1, Math.min(ULTIMA_ETAPA, novaEtapa)));
        await descarregarEdicoes();
    };

    const abrirWizard = () => {
        setEtapa(1);
        setEditando(true);
    };

    const proximo = async () => {
        if (etapa < ULTIMA_ETAPA) {
            irParaEtapa(etapa + 1);
        } else {
            setEditando(false);
            setDados(prev => ({ ...prev, completo: true }));
            await Promise.allSettled([
                saveImmediate({ ...dadosRef.current, completo: true }),
                saveDependentesImmediate(dependentesRef.current),
            ]);
        }
    };

    const voltar = () => {
        if (etapa > 1) irParaEtapa(etapa - 1);
        else { descarregarEdicoes(); setEditando(false); }
    };

    // Completude por etapa (baseada em dados preenchidos, não na posição atual)
    const temDados = (id: number): boolean => {
        switch (id) {
            case 1: return !!dados.peso_cliente || !!dados.altura_cliente;
            case 2: return dependentes.some(d => (d.auxilio_mensal || 0) > 0 || (d.total_calculado || 0) > 0);
            case 3: return (dados.renda_cliente || 0) > 0 || (dados.despesas_obrigatorias || 0) > 0;
            case 4: return (dados.bens_cliente || 0) > 0 || (dados.funeral_cliente || 0) > 0 || (dados.investimentos_cliente || 0) > 0;
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
            {editando && (
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
            {editando && (
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
            )}

            {/* ── Conteúdo da Etapa ──────────────────────────────────────────────── */}
            {!editando ? (
                <DashboardProtecao
                    dados={dados}
                    dependentes={dependentes}
                    parametros={parametros}
                    nomeCliente={nomeCliente}
                    onEditar={abrirWizard}
                    membros={membros}
                    membroAtivo={visao === VISAO_FAMILIA ? null : visao}
                    onAtualizar={campos => setDados(prev => ({ ...prev, ...campos }))}
                />
            ) : (
                <>
                    {etapa === 1 && (
                        <EtapaDadosPessoais dados={dados} onChange={handleChange} />
                    )}
                    {etapa === 2 && (
                        <EtapaEducacao
                            dependentes={dependentes}
                            onChange={handleChangeDependentes}
                            parametros={parametros}
                        />
                    )}
                    {etapa === 3 && (
                        <EtapaPadraoVida
                            dados={dados}
                            onChange={handleChange}
                            onChangeMultiple={handleChangeMultiple}
                            parametros={parametros}
                        />
                    )}
                    {etapa === 4 && (
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
                            className="px-5 h-[40px] flex items-center justify-center rounded-lg border border-subtle text-[color:var(--text-muted)] font-semibold text-[11px] uppercase tracking-widest hover:bg-surface-2 transition-all"
                        >
                            {etapa === 1 ? '← Painel' : '← Voltar'}
                        </button>
                        <button
                            onClick={proximo}
                            className="px-6 h-[40px] flex items-center justify-center rounded-lg bg-[color:var(--primary)] text-white font-bold text-[11px] uppercase tracking-widest hover:opacity-90 transition-all shadow-sm"
                        >
                            {etapa === ULTIMA_ETAPA ? 'Concluir →' : 'Próximo →'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default StepperProtecao;
