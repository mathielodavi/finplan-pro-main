import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, AlertCircle } from 'lucide-react';
import { DividaConsorcio, AssetType, ContractType, MonetaryIndex, ContemplationStatus, BidStrategy } from '../../types/dividas';
import Button from '../UI/Button';
import Input from '../UI/Input';

interface Props {
    open: boolean;
    onClose: () => void;
    onSave: (consorcio: Partial<DividaConsorcio>) => void;
    initialData?: DividaConsorcio;
    clienteId: string;
}

const ASSET_OPTIONS: { value: AssetType, label: string }[] = [
    { value: 'real_estate', label: 'Imóvel' },
    { value: 'vehicle', label: 'Veículo' },
    { value: 'heavy_equipment', label: 'Equipamento Pesado' },
    { value: 'services', label: 'Serviços' },
    { value: 'other', label: 'Outro' },
];

const CONTRACT_OPTIONS: { value: ContractType, label: string }[] = [
    { value: 'fixed_installment', label: 'Parcela Fixa (Muda carta)' },
    { value: 'reduced_installment', label: 'Parcela Reduzida (Retém % carta)' },
];

const INDEX_OPTIONS: { value: MonetaryIndex, label: string }[] = [
    { value: 'INCC', label: 'INCC (Imóveis)' },
    { value: 'IPCA', label: 'IPCA' },
    { value: 'IGP-M', label: 'IGP-M' },
    { value: 'fixed', label: 'Fixo' },
    { value: 'none', label: 'Sem Correção' },
];

const STATUS_OPTIONS: { value: ContemplationStatus, label: string }[] = [
    { value: 'not_contemplated', label: 'Não Contemplado' },
    { value: 'contemplated_by_draw', label: 'Contemplado por Sorteio' },
    { value: 'contemplated_by_bid', label: 'Contemplado por Lance' },
    { value: 'awaiting_confirmation', label: 'Aguardando Confirmação' },
];

const STRATEGY_OPTIONS: { value: BidStrategy, label: string }[] = [
    { value: 'none', label: 'Sem Estratégia / Apenas Sorteio' },
    { value: 'own_resources', label: 'Lance com Recursos Próprios' },
    { value: 'fgts', label: 'Lance com FGTS' },
    { value: 'credit_bid', label: 'Lance Embutido' },
    { value: 'mixed', label: 'Estratégia Mista' },
];

const ModalFormConsorcio: React.FC<Props> = ({ open, onClose, onSave, initialData, clienteId }) => {
    const [formData, setFormData] = useState<Partial<DividaConsorcio>>({
        cliente_id: clienteId,
        asset_type: 'real_estate',
        contract_type: 'fixed_installment',
        monetary_index: 'INCC',
        contemplation_status: 'not_contemplated',
        bid_strategy: 'none',
        start_date: new Date().toISOString().split('T')[0],
        fgts_eligible: false,
        asset_released: false
    });

    useEffect(() => {
        if (open) {
            if (initialData) setFormData(initialData);
            else setFormData({
                cliente_id: clienteId,
                asset_type: 'real_estate',
                consortium_label: '',
                administrator: '',
                credit_letter_value: 0,
                total_installments: 120,
                remaining_installments: 120,
                current_installment_value: 0,
                contract_type: 'fixed_installment',
                admin_fee_total: 0,
                admin_fee_monthly: 0,
                reserve_fund_rate: 0,
                insurance_monthly: 0,
                monetary_index: 'INCC',
                monetary_correction_accumulated: 0,
                contemplation_status: 'not_contemplated',
                asset_released: false,
                fgts_eligible: false,
                last_assembly_number: 1,
                group_size: 100,
                bid_strategy: 'none',
                total_paid_to_date: 0,
                start_date: new Date().toISOString().split('T')[0],
            });
        }
    }, [open, initialData, clienteId]);

    // Enforcing Rule B6 AND Rule B7 instantly on UI
    useEffect(() => {
        setFormData(prev => {
            let next = { ...prev };
            // Rule B6: fgts_eligible ONLY valid for real_estate
            if (next.asset_type !== 'real_estate' && next.fgts_eligible) {
                next.fgts_eligible = false;
                if (next.bid_strategy === 'fgts') next.bid_strategy = 'none';
            }
            // Rule B7: asset_released can only be true if contemplated
            if (next.contemplation_status !== 'contemplated_by_draw' && next.contemplation_status !== 'contemplated_by_bid') {
                next.asset_released = false;
            }
            return next;
        });
    }, [formData.asset_type, formData.contemplation_status]);

    if (!open) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        let finalVal: any = value;
        if (type === 'number') finalVal = Number(value);
        if (type === 'checkbox') finalVal = (e.target as HTMLInputElement).checked;

        setFormData(prev => ({ ...prev, [name]: finalVal }));
    };

    const handleSalvar = () => {
        // Enforcing derived logic (Calculated via Motor before Save to show on Dashboard)
        onSave({
            ...formData,
            real_monthly_cost: 0, // Engine calculates
            embedded_total_cost_pct: 0 // Engine calculates
        });
    };

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl overflow-hidden animate-slide-up flex flex-col max-h-[95vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                            {initialData ? 'Editar Consórcio' : 'Novo Registro de Consórcio'}
                        </h2>
                        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest mt-1">Regras isentas de Juros Compostos</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <div className="bg-sky-50 text-sky-700 px-4 py-3 rounded-xl text-[11px] font-medium flex gap-3 mb-6 items-start border border-sky-100">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        Aviso DCMM: Consórcios diferem logicamente de Créditos. Não aplique CET ou juros compostos. Os custos reais embutidos são regidos pelas Taxas de Administração e Fundos de Reserva (Regra B1 e B3).
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                        {/* Seção 1: Identificação */}
                        <div className="col-span-full border-b border-slate-100 pb-2 mb-2">
                            <h3 className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">1. Identificação Básica</h3>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Identificador</label>
                            <Input name="consortium_label" value={formData.consortium_label || ''} onChange={handleChange} placeholder="Consórcio Imobiliário Caixa" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Administradora</label>
                            <Input name="administrator" value={formData.administrator || ''} onChange={handleChange} placeholder="Rodobens / Embracon" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Tipo do Bem</label>
                            <select name="asset_type" value={formData.asset_type || 'real_estate'} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2.5 outline-none">
                                {ASSET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>

                        {/* Seção 2: Financeiro Base */}
                        <div className="col-span-full border-b border-slate-100 pb-2 mb-2 mt-4">
                            <h3 className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">2. Estrutura da Carta</h3>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Valor da Carta (R$)</label>
                            <Input type="number" name="credit_letter_value" value={formData.credit_letter_value || ''} onChange={handleChange} min={0} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Parcela Atual (R$)</label>
                            <Input type="number" name="current_installment_value" value={formData.current_installment_value || ''} onChange={handleChange} min={0} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Regra Contratual</label>
                            <select name="contract_type" value={formData.contract_type || 'fixed_installment'} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2.5 outline-none">
                                {CONTRACT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Total de Parcelas (Meses)</label>
                            <Input type="number" name="total_installments" value={formData.total_installments || ''} onChange={handleChange} min={1} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Parcelas Restantes (Meses)</label>
                            <Input type="number" name="remaining_installments" value={formData.remaining_installments || ''} onChange={handleChange} min={0} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Total Pago até Agora (R$)</label>
                            <Input type="number" name="total_paid_to_date" value={formData.total_paid_to_date || ''} onChange={handleChange} min={0} />
                        </div>

                        {/* Seção 3: Taxas Inerentes */}
                        <div className="col-span-full border-b border-slate-100 pb-2 mb-2 mt-4">
                            <h3 className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">3. Custos Embutidos</h3>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Taxa de Adm. (Total %)</label>
                            <Input type="number" name="admin_fee_total" value={formData.admin_fee_total || ''} onChange={handleChange} step="0.01" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Fundo de Reserva (%)</label>
                            <Input type="number" name="reserve_fund_rate" value={formData.reserve_fund_rate || ''} onChange={handleChange} step="0.01" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Seguro de Vida (Opcional - R$ Mensal)</label>
                            <Input type="number" name="insurance_monthly" value={formData.insurance_monthly || ''} onChange={handleChange} step="0.01" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Índice Correção Monetária</label>
                            <select name="monetary_index" value={formData.monetary_index || 'INCC'} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2.5 outline-none">
                                {INDEX_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Correção Acumulada (%)</label>
                            <Input type="number" name="monetary_correction_accumulated" value={formData.monetary_correction_accumulated || ''} onChange={handleChange} step="0.01" />
                        </div>

                        {/* Seção 4: Status do Grupo e Contemplação */}
                        <div className="col-span-full border-b border-slate-100 pb-2 mb-2 mt-4">
                            <h3 className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">4. Sorteio e Lance</h3>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Status de Contemplação</label>
                            <select name="contemplation_status" value={formData.contemplation_status || 'not_contemplated'} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2.5 outline-none">
                                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Estratégia de Lance</label>
                            <select name="bid_strategy" value={formData.bid_strategy || 'none'} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2.5 outline-none">
                                {STRATEGY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Membros Ativos no Grupo</label>
                            <Input type="number" name="group_size" value={formData.group_size || ''} onChange={handleChange} />
                        </div>

                        {/* Switches */}
                        <div className="col-span-full flex flex-col md:flex-row gap-6 mt-2 pt-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <label className={`flex items-center gap-3 cursor-pointer ${formData.asset_type !== 'real_estate' ? 'opacity-50' : ''}`} title="Apenas válido para imóveis (Rule B6)">
                                <input type="checkbox" name="fgts_eligible" checked={formData.fgts_eligible} onChange={handleChange} disabled={formData.asset_type !== 'real_estate'} className="w-5 h-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
                                <div>
                                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Elegível ao FGTS</div>
                                    <div className="text-[9px] text-slate-400">Pode usar fundo de garantia para lances (Regra B6)</div>
                                </div>
                            </label>

                            <label className={`flex items-center gap-3 cursor-pointer ${formData.contemplation_status === 'not_contemplated' ? 'opacity-50' : ''}`} title="Necessita estar contemplado (Rule B7)">
                                <input type="checkbox" name="asset_released" checked={formData.asset_released} onChange={handleChange} disabled={formData.contemplation_status === 'not_contemplated'} className="w-5 h-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
                                <div>
                                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Carta Liberada (Ativo Comprado)</div>
                                    <div className="text-[9px] text-slate-400">Recurso do consórcio já foi utilizado (Regra B7)</div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button variant="primary" onClick={handleSalvar} className="bg-sky-600 hover:bg-sky-700">
                        <Save size={16} className="mr-2" />
                        {initialData ? 'Salvar Alterações' : 'Registrar Consórcio'}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ModalFormConsorcio;
