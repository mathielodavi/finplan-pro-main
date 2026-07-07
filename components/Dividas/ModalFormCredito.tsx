import React, { useState, useEffect } from 'react';
import { AlertCircle, Save } from 'lucide-react';
import { DividaCredito, DebtType, AmortizationSystem } from '../../types/dividas';
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
    remaining_installments: 1,
    outstanding_balance: 0,
    payoff_balance: 0,
    cet_monthly: 0,
    amortization_system: 'price',
    monetary_correction_annual: undefined,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
};

const ModalFormCredito: React.FC<Props> = ({ open, onClose, onSave, initialData, clienteId }) => {
    const [salvando, setSalvando] = useState(false);
    const [formData, setFormData] = useState<Partial<DividaCredito>>({ cliente_id: clienteId, ...DEFAULT_FORM });

    useEffect(() => {
        if (open) {
            setFormData(initialData ? initialData : { cliente_id: clienteId, ...DEFAULT_FORM });
        }
    }, [open, initialData, clienteId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? Number(value) : value
        }));
    };

    const handleSalvar = async () => {
        // CET anual é derivado do CET mensal (juros compostos).
        const cetMensal = formData.cet_monthly || 0;
        const cetAnual = (Math.pow(1 + (cetMensal / 100), 12) - 1) * 100;

        const totalPaid = Math.max(0, (formData.total_installments || 0) - (formData.remaining_installments || 0)) * (formData.installment_value || 0);

        setSalvando(true);
        try {
            await onSave({
                ...formData,
                cet_annual: cetAnual,
                total_paid: totalPaid,
                income_commitment: formData.income_commitment ?? 0, // recalculado downstream a partir da renda do cliente
            });
        } finally {
            setSalvando(false);
        }
    };

    const isFinanciamento = formData.debt_type === 'financing';

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
                O Custo Efetivo Total Anual (CET) e o Comprometimento de Renda são calculados automaticamente a partir dos dados informados.
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Nome/Identificador da Dívida</label>
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
                    <InputMoeda label="Valor Financiado / Contratado (R$)" value={formData.contracted_value} onChange={(v) => setFormData(prev => ({ ...prev, contracted_value: v }))} />
                </div>
                <div>
                    <InputMoeda label="Parcela Atual Mensal (R$)" value={formData.installment_value} onChange={(v) => setFormData(prev => ({ ...prev, installment_value: v }))} />
                </div>

                <div>
                    <InputMoeda label="Saldo Devedor Atual (R$)" value={formData.outstanding_balance} onChange={(v) => setFormData(prev => ({ ...prev, outstanding_balance: v }))} />
                </div>
                <div>
                    <InputMoeda
                        label="Valor de Quitação Antecipada (R$)"
                        value={formData.payoff_balance}
                        onChange={(v) => setFormData(prev => ({ ...prev, payoff_balance: v }))}
                        helperText="Saldo devedor e valor de quitação são registrados separadamente — a quitação pode ter desconto."
                    />
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Total de Parcelas (Meses)</label>
                    <Input type="number" name="total_installments" value={formData.total_installments || ''} onChange={handleChange} min={1} />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Parcelas Restantes (Meses)</label>
                    <Input type="number" name="remaining_installments" value={formData.remaining_installments || ''} onChange={handleChange} min={0} />
                </div>

                <div>
                    <InputPercentual
                        label="Taxa de Juros Mensal (CET - % a.m.)"
                        value={formData.cet_monthly}
                        onChange={(v) => setFormData(prev => ({ ...prev, cet_monthly: v }))}
                        helperText="Informe a taxa mensal — a anual é derivada automaticamente."
                    />
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
