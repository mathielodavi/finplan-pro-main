import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, AlertCircle } from 'lucide-react';
import { DividaCredito, DebtType } from '../../types/dividas';
import Button from '../UI/Button';
import Input from '../UI/Input';

interface Props {
    open: boolean;
    onClose: () => void;
    onSave: (credito: Partial<DividaCredito>) => void | Promise<void>;
    initialData?: DividaCredito;
    clienteId: string;
}

const TYPE_OPTIONS: { value: DebtType, label: string }[] = [
    { value: 'personal_loan', label: 'Crédito Pessoal' },
    { value: 'financing', label: 'Financiamento' },
    { value: 'credit_card', label: 'Cartão de Crédito / Parcelamento' },
    { value: 'overdraft', label: 'Cheque Especial' },
    { value: 'other', label: 'Outro' },
];

const ModalFormCredito: React.FC<Props> = ({ open, onClose, onSave, initialData, clienteId }) => {
    const [salvando, setSalvando] = useState(false);
    const [formData, setFormData] = useState<Partial<DividaCredito>>({
        cliente_id: clienteId,
        debt_type: 'personal_loan',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
    });

    useEffect(() => {
        if (open) {
            if (initialData) setFormData(initialData);
            else setFormData({
                cliente_id: clienteId,
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
                start_date: new Date().toISOString().split('T')[0],
                end_date: new Date().toISOString().split('T')[0],
            });
        }
    }, [open, initialData, clienteId]);

    if (!open) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? Number(value) : value
        }));
    };

    const handleSalvar = async () => {
        // Enforcing Rule A1 (CET Annual derived from CET Monthly)
        const cetMensal = formData.cet_monthly || 0;
        const cetAnual = (Math.pow(1 + (cetMensal / 100), 12) - 1) * 100;

        // Enforcing Rule A5 (Total Paid is derived, will be calculated later, but saving snapshot)
        const totalPaid = Math.max(0, (formData.total_installments || 0) - (formData.remaining_installments || 0)) * (formData.installment_value || 0);

        setSalvando(true);
        try {
            await onSave({
                ...formData,
                cet_annual: cetAnual,
                total_paid: totalPaid,
                income_commitment: 0 // Will be derived downstream based on client income
            });
        } finally {
            setSalvando(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-surface-3/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-surface rounded-[16px] shadow-xl w-full max-w-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-subtle flex justify-between items-center bg-surface-2">
                    <div>
                        <h2 className="text-[16px] font-bold text-main tracking-tight">
                            {initialData ? 'Editar Dívida de Crédito' : 'Novo Registro de Crédito'}
                        </h2>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mt-0.5">Passivo com Juros Implícitos</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-faint hover:text-muted hover:bg-surface-3 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <div className="bg-amber-50 text-amber-700 px-4 py-3 rounded-[8px] text-[11px] font-bold tracking-wider uppercase flex gap-3 mb-6 items-start border border-amber-100">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        Aviso: O Custo Efetivo Total Anual (CET) e o Comprometimento de Renda serão calculados e indexados automaticamente pelo Motor DCMM após o salvamento.
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
                                className="w-full bg-surface-2 border border-subtle text-main text-[12px] font-bold rounded-[8px] px-3 h-9 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
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
                            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Valor Financiado / Contratado (R$)</label>
                            <Input type="number" name="contracted_value" value={formData.contracted_value || ''} onChange={handleChange} min={0} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Parcela Atual Mensal (R$)</label>
                            <Input type="number" name="installment_value" value={formData.installment_value || ''} onChange={handleChange} min={0} />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Saldo Devedor Atual (R$)</label>
                            <Input type="number" name="outstanding_balance" value={formData.outstanding_balance || ''} onChange={handleChange} min={0} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Valor de Quitação Antecipada (R$)</label>
                            <Input type="number" name="payoff_balance" value={formData.payoff_balance || ''} onChange={handleChange} min={0} />
                            <p className="text-[9px] text-faint mt-1">Rule A4: Saldo e quitação separadas</p>
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
                            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Taxa de Juros Mensal (CET - % a.m.)</label>
                            <Input type="number" name="cet_monthly" value={formData.cet_monthly || ''} onChange={handleChange} step="0.01" />
                            <p className="text-[9px] text-faint mt-1">Rule A1: Insira a.m., nós derivamos a.a.</p>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-subtle flex justify-end gap-3 bg-surface-2">
                    <Button variant="outline" onClick={onClose} className="h-9 px-4 text-[11px] font-bold uppercase tracking-wider">Cancelar</Button>
                    <Button variant="primary" onClick={handleSalvar} isLoading={salvando} className="bg-indigo-600 hover:bg-indigo-700 h-9 px-4 text-[11px] font-bold uppercase tracking-wider">
                        <Save size={14} className="mr-1.5" />
                        {initialData ? 'Salvar Alterações' : 'Registrar Crédito'}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ModalFormCredito;
