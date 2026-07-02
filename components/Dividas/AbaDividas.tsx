import React, { useState, useEffect, useCallback } from 'react';
import { DividaCredito, DividaConsorcio, PrioritizationMethod } from '../../types/dividas';
import { dividasService } from '../../services/dividasService';
import DashboardDividas from './DashboardDividas';
import ListaDividas from './ListaDividas';
import { ordenarAvalanche, ordenarSnowball, ordenarConsorcios } from '../../utils/ordenacaoDividas';
import Button from '../UI/Button';
import { Plus, Settings2, FileDigit } from 'lucide-react';
import ModalFormCredito from './ModalFormCredito';
import ModalFormConsorcio from './ModalFormConsorcio';
import PanelDetalheCredito from './PanelDetalheCredito';
import PanelDetalheConsorcio from './PanelDetalheConsorcio';
import Confirmacao from '../Confirmacao';

interface Props {

    clienteId: string;
    rendaMensalCliente?: number; // fallback caso não seja injetado, buscaríamos do configService ou passariamos prop
}

const AbaDividas: React.FC<Props> = ({ clienteId, rendaMensalCliente = 10000 }) => {
    const [creditos, setCreditos] = useState<DividaCredito[]>([]);
    const [consorcios, setConsorcios] = useState<DividaConsorcio[]>([]);
    const [prioritizationMethod, setPrioritizationMethod] = useState<PrioritizationMethod>('avalanche');
    const [loading, setLoading] = useState(true);

    // UI State
    const [showOptionsNovo, setShowOptionsNovo] = useState(false);
    const [modalCreditoOpen, setModalCreditoOpen] = useState(false);
    const [modalConsorcioOpen, setModalConsorcioOpen] = useState(false);

    // Selection State (Detail Panels)
    const [selectedCredito, setSelectedCredito] = useState<DividaCredito | null>(null);
    const [selectedConsorcio, setSelectedConsorcio] = useState<DividaConsorcio | null>(null);
    const [excluirAlvo, setExcluirAlvo] = useState<{ tipo: 'credito' | 'consorcio'; id: string } | null>(null);
    const [excluindoDivida, setExcluindoDivida] = useState(false);

    const loadDados = useCallback(async () => {
        setLoading(true);
        try {
            const [metodo, crData, coData] = await Promise.all([
                dividasService.getPrioritizationMethod(clienteId),
                dividasService.getCreditos(clienteId),
                dividasService.getConsorcios(clienteId)
            ]);

            setPrioritizationMethod(metodo);
            setCreditos(crData);
            setConsorcios(coData);
        } catch (err) {
            console.error('Erro ao carregar módulo DCMM', err);
        } finally {
            setLoading(false);
        }
    }, [clienteId]);

    useEffect(() => {
        loadDados();
    }, [loadDados]);

    const handleMethodChange = async (method: PrioritizationMethod) => {
        setPrioritizationMethod(method);
        // Atualiza no banco mas a listagem ordena assincronamente (client-side render via state)
        await dividasService.updatePrioritizationMethod(clienteId, method);
    };

    // Ordenação Client-Side Reativa
    const sortedCreditos = prioritizationMethod === 'avalanche'
        ? ordenarAvalanche(creditos)
        : ordenarSnowball(creditos);

    const sortedConsorcios = ordenarConsorcios(consorcios, prioritizationMethod);

    const handleSaveCredito = async (credito: Partial<DividaCredito>) => {
        try {
            await dividasService.createCredito(credito as Omit<DividaCredito, 'debt_id'>);
            setModalCreditoOpen(false);
            loadDados();
        } catch (err) {
            alert('Erro ao salvar crédito');
        }
    };

    const handleSaveConsorcio = async (consorcio: Partial<DividaConsorcio>) => {
        try {
            await dividasService.createConsorcio(consorcio as Omit<DividaConsorcio, 'consortium_id'>);
            setModalConsorcioOpen(false);
            loadDados();
        } catch (err) {
            alert('Erro ao salvar consórcio');
        }
    };

    const handleDeleteCredito = (id: string) => setExcluirAlvo({ tipo: 'credito', id });
    const handleDeleteConsorcio = (id: string) => setExcluirAlvo({ tipo: 'consorcio', id });

    const confirmarExclusaoDivida = async () => {
        if (!excluirAlvo) return;
        setExcluindoDivida(true);
        try {
            if (excluirAlvo.tipo === 'credito') {
                await dividasService.deleteCredito(excluirAlvo.id);
                setSelectedCredito(null);
            } else {
                await dividasService.deleteConsorcio(excluirAlvo.id);
                setSelectedConsorcio(null);
            }
            setExcluirAlvo(null);
            loadDados();
        } catch {
            alert('Erro ao excluir.');
        } finally {
            setExcluindoDivida(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-40 gap-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                <p className="text-faint font-bold uppercase tracking-[0.2em] text-[10px]">Carregando Módulo Dívidas...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in relative">

            {/* Header / Ações */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface px-5 py-4 rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <div>
                    <h2 className="text-[16px] font-bold text-main tracking-tight">Gestão de Passivos e Consórcios</h2>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider mt-0.5">Motor de Inteligência e Priorização Financeira</p>
                </div>

                <div className="flex gap-3">
                    <div className="flex bg-surface-2 p-1 rounded-[8px] border border-subtle h-9">
                        <button
                            className={`px-4 rounded-[6px] text-[10px] font-bold uppercase tracking-wider transition-all h-full flex items-center ${prioritizationMethod === 'avalanche' ? 'bg-surface shadow-sm text-indigo-600 border border-subtle/50' : 'text-faint hover:text-muted'}`}
                            onClick={() => handleMethodChange('avalanche')}
                            title="Avalanche: Foca em quitar as dívidas com maiores taxas antes"
                        >
                            Avalanche
                        </button>
                        <button
                            className={`px-4 rounded-[6px] text-[10px] font-bold uppercase tracking-wider transition-all h-full flex items-center ${prioritizationMethod === 'snowball' ? 'bg-surface shadow-sm text-indigo-600 border border-subtle/50' : 'text-faint hover:text-muted'}`}
                            onClick={() => handleMethodChange('snowball')}
                            title="Snowball: Foca em quitar as dívidas com menores saldos antes (motivacional)"
                        >
                            Snowball
                        </button>
                    </div>

                    <Button variant="outline" className="text-[10px] px-4 font-bold tracking-wider uppercase gap-2 h-9">
                        <Settings2 size={14} />
                        Preferências
                    </Button>

                    <div className="relative">
                        <Button
                            variant="primary"
                            className="text-[10px] px-4 font-bold tracking-wider uppercase gap-2 bg-indigo-600 hover:bg-indigo-700 h-9"
                            onClick={() => setShowOptionsNovo(!showOptionsNovo)}
                        >
                            <Plus size={14} />
                            Novo Registro
                        </Button>

                        {showOptionsNovo && (
                            <div className="absolute right-0 top-full mt-2 bg-surface rounded-xl shadow-xl border border-subtle p-2 w-48 z-10 flex flex-col gap-1">
                                <button
                                    className="flex items-center justify-start gap-3 w-full text-left px-3 py-2 text-[10px] font-bold tracking-widest uppercase text-muted hover:bg-surface-2 rounded-lg transition-colors"
                                    onClick={() => { setModalCreditoOpen(true); setShowOptionsNovo(false); }}
                                >
                                    <FileDigit size={14} className="text-indigo-500" />
                                    Crédito Simples
                                </button>
                                <button
                                    className="flex items-center justify-start gap-3 w-full text-left px-3 py-2 text-[10px] font-bold tracking-widest uppercase text-muted hover:bg-surface-2 rounded-lg transition-colors"
                                    onClick={() => { setModalConsorcioOpen(true); setShowOptionsNovo(false); }}
                                >
                                    <FileDigit size={14} className="text-sky-500" />
                                    Consórcio
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Layer 3 - Visual / Dashboards */}
            <DashboardDividas
                creditos={sortedCreditos}
                consorcios={sortedConsorcios}
                rendaMensalCliente={rendaMensalCliente}
            />

            {/* Layer 3 - Lista */}
            <ListaDividas
                creditos={sortedCreditos}
                consorcios={sortedConsorcios}
                prioritizationMethod={prioritizationMethod}
                rendaMensalCliente={rendaMensalCliente}
                onSelectCredito={(cred) => setSelectedCredito(cred)}
                onSelectConsorcio={(cons) => setSelectedConsorcio(cons)}
            />

            <ModalFormCredito
                open={modalCreditoOpen}
                onClose={() => setModalCreditoOpen(false)}
                onSave={handleSaveCredito}
                clienteId={clienteId}
            />

            <ModalFormConsorcio
                open={modalConsorcioOpen}
                onClose={() => setModalConsorcioOpen(false)}
                onSave={handleSaveConsorcio}
                clienteId={clienteId}
            />

            {/* Overlay Panels */}
            {selectedCredito && (
                <div className="fixed inset-0 bg-surface-3/40 backdrop-blur-sm z-[9998] transition-opacity" onClick={() => setSelectedCredito(null)} />
            )}
            <PanelDetalheCredito
                open={!!selectedCredito}
                onClose={() => setSelectedCredito(null)}
                credito={selectedCredito}
                onDelete={handleDeleteCredito}
                onEdit={(c) => {
                    /* Implementar prepopulate no ModalForm no futuro */
                    setSelectedCredito(null);
                    setModalCreditoOpen(true);
                }}
            />

            {selectedConsorcio && (
                <div className="fixed inset-0 bg-surface-3/40 backdrop-blur-sm z-[9998] transition-opacity" onClick={() => setSelectedConsorcio(null)} />
            )}
            <PanelDetalheConsorcio
                open={!!selectedConsorcio}
                onClose={() => setSelectedConsorcio(null)}
                consorcio={selectedConsorcio}
                onDelete={handleDeleteConsorcio}
                rendaMensalCliente={rendaMensalCliente}
                onEdit={(c) => {
                    setSelectedConsorcio(null);
                    setModalConsorcioOpen(true);
                }}
            />

            <Confirmacao
                isOpen={!!excluirAlvo}
                onClose={() => setExcluirAlvo(null)}
                onConfirm={confirmarExclusaoDivida}
                loading={excluindoDivida}
                title={excluirAlvo?.tipo === 'consorcio' ? 'Excluir consórcio' : 'Excluir dívida de crédito'}
                message={excluirAlvo?.tipo === 'consorcio' ? 'Deseja realmente excluir este consórcio?' : 'Deseja realmente excluir esta dívida de crédito?'}
            />

        </div>
    );
};

export default AbaDividas;
