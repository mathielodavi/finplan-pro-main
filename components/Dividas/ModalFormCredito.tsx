import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Save } from 'lucide-react';
import { DividaCredito, DebtType, AmortizationSystem, DebtSituacao, TaxaNominalUnidade } from '../../types/dividas';
import {
    derivarCetAnual,
    calcularCetImplicitoPrice,
    calcularCetImplicitoSac,
    calcularSaldoEParcelasAtual,
    calcularDataFim,
    calcularComprometimentoRenda,
} from '../../utils/calculosDividas';
import { taxaAnualParaMensal } from '../../utils/calculosFinanceiros';
import { toast } from '../../utils/toast';
import Button from '../UI/Button';
import Input from '../UI/Input';
import InputMoeda from '../UI/InputMoeda';
import InputPercentual from '../UI/InputPercentual';
import SidePanel from '../UI/SidePanel';

interface Props {
    open: boolean;
    onClose: () => void;
    onSave: (credito: Partial<DividaCredito>) => void | Promise<void>;
    initialData?: DividaCredito | null;
    clienteId: string;
    rendaMensalCliente?: number;
}

const TYPE_OPTIONS: { value: DebtType, label: string }[] = [
    { value: 'personal_loan', label: 'Crédito Pessoal' },
    { value: 'financing', label: 'Financiamento' },
    { value: 'credit_card', label: 'Cartão de Crédito / Parcelamento' },
    { value: 'overdraft', label: 'Cheque Especial' },
    { value: 'other', label: 'Outro' },
];

const AMORTIZATION_OPTIONS: { value: AmortizationSystem, label: string }[] = [
    { value: 'price', label: 'Price (parcela fixa)' },
    { value: 'sac', label: 'SAC (amortização constante, parcela decrescente)' },
];

const DEFAULT_FORM: Partial<DividaCredito> = {
    debt_type: 'personal_loan',
    debt_label: '',
    institution: '',
    contracted_value: 0,
    installment_value: 0,
    total_installments: 1,
    situacao: 'em_dia',
    payoff_balance: 0,
    cet_monthly: 0,
    cet_annual: 0,
    amortization_system: 'price',
    monetary_correction_annual: undefined,
    start_date: new Date().toISOString().split('T')[0],
};

const toggleBtn = (active: boolean, danger = false) =>
    `flex-1 h-9 rounded-[8px] text-[11px] font-bold uppercase tracking-wider transition-all border ${active
        ? (danger ? 'bg-danger/10 text-danger border-danger/30' : 'bg-primary/10 text-primary border-primary/30')
        : 'bg-surface-2 text-faint border-subtle hover:text-muted'}`;

const ModalFormCredito: React.FC<Props> = ({ open, onClose, onSave, initialData, clienteId, rendaMensalCliente = 0 }) => {
    const [salvando, setSalvando] = useState(false);
    const [formData, setFormData] = useState<Partial<DividaCredito>>({ cliente_id: clienteId, ...DEFAULT_FORM });
    /** Rastreia se o usuário editou o CET manualmente (e por qual campo) — evita que o
     * auto-cálculo sobrescreva uma edição manual, sem precisar de efeitos encadeados. */
    const cetOrigemEdicao = useRef<'mensal' | 'anual' | null>(null);

    useEffect(() => {
        if (open) {
            setFormData(initialData ? initialData : { cliente_id: clienteId, ...DEFAULT_FORM });
            cetOrigemEdicao.current = null;
        }
    }, [open, initialData, clienteId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? Number(value) : value
        }));
    };

    // Auto-calcula o CET a partir dos dados básicos (valor contratado, parcela, nº de
    // parcelas) só para registro NOVO e enquanto o usuário não tiver editado o CET
    // manualmente — nunca sobrescreve um registro existente nem uma edição já feita.
    useEffect(() => {
        if (initialData || cetOrigemEdicao.current !== null) return;
        const { contracted_value, installment_value, total_installments, amortization_system } = formData;
        if (!contracted_value || !installment_value || !total_installments) return;
        const cetMensal = amortization_system === 'sac'
            ? calcularCetImplicitoSac(contracted_value, installment_value, total_installments)
            : calcularCetImplicitoPrice(contracted_value, installment_value, total_installments);
        setFormData(prev => ({ ...prev, cet_monthly: cetMensal, cet_annual: derivarCetAnual(cetMensal) }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.contracted_value, formData.installment_value, formData.total_installments, formData.amortization_system, initialData]);

    const handleCetMensalChange = (v: number) => {
        cetOrigemEdicao.current = 'mensal';
        setFormData(prev => ({ ...prev, cet_monthly: v, cet_annual: derivarCetAnual(v) }));
    };

    const handleCetAnualChange = (v: number) => {
        cetOrigemEdicao.current = 'anual';
        setFormData(prev => ({ ...prev, cet_annual: v, cet_monthly: taxaAnualParaMensal(v) * 100 }));
    };

    const handleSalvar = async () => {
        if (formData.situacao === 'em_atraso' && !formData.parcela_ultimo_pagamento) {
            toast.error('Informe a parcela do último pagamento para dívidas em atraso.');
            return;
        }

        const { saldoDevedor, parcelasAbertas } = calcularSaldoEParcelasAtual(formData as DividaCredito);
        const startDate = formData.start_date || new Date().toISOString().split('T')[0];
        const endDate = calcularDataFim(startDate, formData.total_installments || 0);
        const totalPaid = Math.round(Math.max(0, (formData.total_installments || 0) - parcelasAbertas) * (formData.installment_value || 0) * 100) / 100;

        setSalvando(true);
        try {
            await onSave({
                ...formData,
                start_date: startDate,
                outstanding_balance: saldoDevedor,
                remaining_installments: parcelasAbertas,
                end_date: endDate,
                total_paid: totalPaid,
                income_commitment: calcularComprometimentoRenda(formData.installment_value || 0, rendaMensalCliente),
            });
        } finally {
            setSalvando(false);
        }
    };

    const isFinanciamento = formData.debt_type === 'financing';
    const emAtraso = formData.situacao === 'em_atraso';

    return (
        <SidePanel
            open={open}
            onClose={onClose}
            title={initialData ? 'Editar Dívida de Crédito' : 'Novo Registro de Crédito'}
            subtitle="Passivo com juros implícitos"
            widthClass="max-w-lg"
            footer={
                <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose} className="h-9 px-4 text-[11px] font-semibold">Cancelar</Button>
                    <Button variant="primary" onClick={handleSalvar} isLoading={salvando} className="h-9 px-4 text-[11px] font-semibold">
                        <Save size={14} className="mr-1.5" />
                        {initialData ? 'Salvar Alterações' : 'Registrar Crédito'}
                    </Button>
                </div>
            }
        >
            <div className="bg-warning/10 text-warning px-4 py-3 rounded-[8px] text-[11px] font-medium flex gap-3 mb-6 items-start border border-subtle">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                O CET (a.m. e a.a.) e o Saldo Devedor/Parcelas em Aberto são calculados automaticamente a partir dos dados informados — o CET pode ser ajustado manualmente.
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Descrição</label>
                    <Input name="debt_label" value={formData.debt_label || ''} onChange={handleChange} placeholder="Ex: Empréstimo Pessoal Nubank" />
                </div>
                <div className="col-span-2 md:col-span-1">
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Tipo de Linha</label>
                    <select
                        name="debt_type"
                        value={formData.debt_type || 'personal_loan'}
                        onChange={handleChange}
                        className="w-full bg-surface-2 border border-subtle text-main text-[12px] font-bold rounded-[8px] px-3 h-9 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    >
                        {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>

                <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Instituição Originadora</label>
                    <Input name="institution" value={formData.institution || ''} onChange={handleChange} placeholder="Banco XYZ S.A." />
                </div>

                <div className="col-span-2 my-2 border-t border-subtle"></div>

                <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Data</label>
                    <Input type="date" name="start_date" value={formData.start_date || ''} onChange={handleChange} />
                </div>
                <div>
                    <InputMoeda label="Valor Contratado (R$)" value={formData.contracted_value} onChange={(v) => setFormData(prev => ({ ...prev, contracted_value: v }))} />
                </div>

                <div>
                    <InputMoeda label="Valor da Parcela (R$)" value={formData.installment_value} onChange={(v) => setFormData(prev => ({ ...prev, installment_value: v }))} />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Número de Parcelas</label>
                    <Input type="number" name="total_installments" value={formData.total_installments || ''} onChange={handleChange} min={1} />
                </div>

                <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Situação</label>
                    <div className="flex gap-2">
                        <button type="button" className={toggleBtn(!emAtraso)} onClick={() => setFormData(prev => ({ ...prev, situacao: 'em_dia' as DebtSituacao, parcela_ultimo_pagamento: undefined }))}>Em dia</button>
                        <button type="button" className={toggleBtn(emAtraso, true)} onClick={() => setFormData(prev => ({ ...prev, situacao: 'em_atraso' as DebtSituacao }))}>Em atraso</button>
                    </div>
                </div>

                {emAtraso && (
                    <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Parcela do Último Pagamento</label>
                        <Input
                            type="number"
                            name="parcela_ultimo_pagamento"
                            value={formData.parcela_ultimo_pagamento || ''}
                            onChange={handleChange}
                            min={0}
                            max={formData.total_installments}
                            placeholder="Ex: 8 (a 8ª parcela foi a última paga)"
                        />
                    </div>
                )}

                <div className="col-span-2 my-2 border-t border-subtle"></div>

                <div>
                    <InputPercentual
                        label="CET Mensal (% a.m.)"
                        value={formData.cet_monthly}
                        onChange={handleCetMensalChange}
                        casas={4}
                        helperText="Calculado automaticamente — pode ser editado."
                    />
                </div>
                <div>
                    <InputPercentual
                        label="CET Anual (% a.a.)"
                        value={formData.cet_annual}
                        onChange={handleCetAnualChange}
                        casas={2}
                        helperText="Editar aqui recalcula o CET mensal."
                    />
                </div>

                <div>
                    <InputPercentual
                        label="Taxa Nominal (opcional)"
                        value={formData.taxa_nominal}
                        onChange={(v) => setFormData(prev => ({ ...prev, taxa_nominal: v || undefined }))}
                        casas={4}
                        helperText="Informativa — não afeta o CET nem os cálculos."
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Unidade da Taxa Nominal</label>
                    <div className="flex gap-2">
                        <button type="button" className={toggleBtn(formData.taxa_nominal_unidade !== 'aa')} onClick={() => setFormData(prev => ({ ...prev, taxa_nominal_unidade: 'am' as TaxaNominalUnidade }))}>a.m.</button>
                        <button type="button" className={toggleBtn(formData.taxa_nominal_unidade === 'aa')} onClick={() => setFormData(prev => ({ ...prev, taxa_nominal_unidade: 'aa' as TaxaNominalUnidade }))}>a.a.</button>
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Sistema de Amortização</label>
                    <select
                        name="amortization_system"
                        value={formData.amortization_system || 'price'}
                        onChange={handleChange}
                        className="w-full bg-surface-2 border border-subtle text-main text-[12px] font-bold rounded-[8px] px-3 h-9 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    >
                        {AMORTIZATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                <div>
                    <InputMoeda
                        label="Valor de Quitação Antecipada (R$, opcional)"
                        value={formData.payoff_balance}
                        onChange={(v) => setFormData(prev => ({ ...prev, payoff_balance: v }))}
                        helperText="Deixe em 0 se não houver oferta de desconto para quitação."
                    />
                </div>

                {isFinanciamento && (
                    <div className="col-span-2">
                        <InputPercentual
                            label="Correção Monetária Anual (%, opcional)"
                            value={formData.monetary_correction_annual}
                            onChange={(v) => setFormData(prev => ({ ...prev, monetary_correction_annual: v || undefined }))}
                            helperText="Relevante para financiamentos indexados (ex.: SFH/TR). Deixe em 0 se não houver correção."
                        />
                    </div>
                )}
            </div>
        </SidePanel>
    );
};

export default ModalFormCredito;
