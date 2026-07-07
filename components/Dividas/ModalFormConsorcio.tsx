import React, { useState, useEffect } from 'react';
import { AlertCircle, Save } from 'lucide-react';
import { DividaConsorcio, AssetType, ContractType, MonetaryIndex, ContemplationStatus, BidStrategy } from '../../types/dividas';
import Button from '../UI/Button';
import Input from '../UI/Input';
import InputMoeda from '../UI/InputMoeda';
import InputPercentual from '../UI/InputPercentual';
import SidePanel from '../UI/SidePanel';
import { toLocalDateString } from '../../utils/formatadores';

interface Props {
    open: boolean;
    onClose: () => void;
    onSave: (consorcio: Partial<DividaConsorcio>) => void | Promise<void>;
    initialData?: DividaConsorcio | null;
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

const DEFAULT_FORM: Partial<DividaConsorcio> = {
    asset_type: 'real_estate',
    consortium_label: '',
    administrator: '',
    credit_letter_value: 0,
    total_installments: 120,
    remaining_installments: 120,
    current_installment_value: 0,
    contract_type: 'fixed_installment',
    admin_fee_total: 0,
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
    estimated_bid_value: undefined,
    total_paid_to_date: 0,
    start_date: new Date().toISOString().split('T')[0],
};

const ModalFormConsorcio: React.FC<Props> = ({ open, onClose, onSave, initialData, clienteId }) => {
    const [salvando, setSalvando] = useState(false);
    const [formData, setFormData] = useState<Partial<DividaConsorcio>>({ cliente_id: clienteId, ...DEFAULT_FORM });

    useEffect(() => {
        if (open) {
            setFormData(initialData ? initialData : { cliente_id: clienteId, ...DEFAULT_FORM });
        }
    }, [open, initialData, clienteId]);

    // Regras automáticas de negócio, aplicadas em tempo real na UI:
    useEffect(() => {
        setFormData(prev => {
            let next = { ...prev };
            // FGTS só é válido para imóveis.
            if (next.asset_type !== 'real_estate' && next.fgts_eligible) {
                next.fgts_eligible = false;
                if (next.bid_strategy === 'fgts') next.bid_strategy = 'none';
            }
            // O bem só pode ser liberado se o consórcio já foi contemplado.
            if (next.contemplation_status !== 'contemplated_by_draw' && next.contemplation_status !== 'contemplated_by_bid') {
                next.asset_released = false;
            }
            // Data de contemplação é preenchida automaticamente quando o status muda para contemplado.
            const foiContemplado = next.contemplation_status === 'contemplated_by_draw' || next.contemplation_status === 'contemplated_by_bid';
            if (foiContemplado && !next.contemplation_date) {
                next.contemplation_date = toLocalDateString(new Date());
            } else if (!foiContemplado) {
                next.contemplation_date = undefined;
            }
            return next;
        });
    }, [formData.asset_type, formData.contemplation_status]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        let finalVal: any = value;
        if (type === 'number') finalVal = Number(value);
        if (type === 'checkbox') finalVal = (e.target as HTMLInputElement).checked;

        setFormData(prev => ({ ...prev, [name]: finalVal }));
    };

    const handleSalvar = async () => {
        setSalvando(true);
        try {
            await onSave({
                ...formData,
                real_monthly_cost: formData.real_monthly_cost ?? 0, // recalculado ao exibir no painel de detalhe
            });
        } finally {
            setSalvando(false);
        }
    };

    return (
        <SidePanel
            open={open}
            onClose={onClose}
            title={initialData ? 'Editar Consórcio' : 'Novo Registro de Consórcio'}
            subtitle="Regras isentas de juros compostos"
            widthClass="max-w-lg"
            footer={
                <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose} className="h-9 px-4 text-[11px] font-semibold">Cancelar</Button>
                    <Button variant="primary" onClick={handleSalvar} isLoading={salvando} className="h-9 px-4 text-[11px] font-semibold">
                        <Save size={14} className="mr-1.5" />
                        {initialData ? 'Salvar Alterações' : 'Registrar Consórcio'}
                    </Button>
                </div>
            }
        >
            <div className="bg-info/10 text-info px-4 py-3 rounded-[8px] text-[11px] font-medium flex gap-3 mb-6 items-start border border-subtle">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                Consórcios não têm juros compostos. O custo real embutido é regido pela taxa de administração, fundo de reserva e correção monetária.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="col-span-full border-b border-subtle pb-2 mb-1">
                    <h3 className="text-[10px] font-black tracking-widest text-faint uppercase">1. Identificação Básica</h3>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Identificador</label>
                    <Input name="consortium_label" value={formData.consortium_label || ''} onChange={handleChange} placeholder="Consórcio Imobiliário Caixa" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Administradora</label>
                    <Input name="administrator" value={formData.administrator || ''} onChange={handleChange} placeholder="Rodobens / Embracon" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Tipo do Bem</label>
                    <select name="asset_type" value={formData.asset_type || 'real_estate'} onChange={handleChange} className="w-full bg-surface-2 border border-subtle text-main text-[12px] font-bold rounded-[8px] px-3 h-9 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                        {ASSET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>

                <div className="col-span-full border-b border-subtle pb-2 mb-1 mt-3">
                    <h3 className="text-[10px] font-black tracking-widest text-faint uppercase">2. Estrutura da Carta</h3>
                </div>
                <div>
                    <InputMoeda label="Valor da Carta (R$)" value={formData.credit_letter_value} onChange={(v) => setFormData(prev => ({ ...prev, credit_letter_value: v }))} />
                </div>
                <div>
                    <InputMoeda label="Parcela Atual (R$)" value={formData.current_installment_value} onChange={(v) => setFormData(prev => ({ ...prev, current_installment_value: v }))} />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Regra Contratual</label>
                    <select name="contract_type" value={formData.contract_type || 'fixed_installment'} onChange={handleChange} className="w-full bg-surface-2 border border-subtle text-main text-[12px] font-bold rounded-[8px] px-3 h-9 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                        {CONTRACT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
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
                    <InputMoeda label="Total Pago até Agora (R$)" value={formData.total_paid_to_date} onChange={(v) => setFormData(prev => ({ ...prev, total_paid_to_date: v }))} />
                </div>

                <div className="col-span-full border-b border-subtle pb-2 mb-1 mt-3">
                    <h3 className="text-[10px] font-black tracking-widest text-faint uppercase">3. Custos Embutidos</h3>
                </div>
                <div>
                    <InputPercentual label="Taxa de Adm. (Total %)" value={formData.admin_fee_total} onChange={(v) => setFormData(prev => ({ ...prev, admin_fee_total: v }))} />
                </div>
                <div>
                    <InputPercentual label="Fundo de Reserva (%)" value={formData.reserve_fund_rate} onChange={(v) => setFormData(prev => ({ ...prev, reserve_fund_rate: v }))} />
                </div>
                <div>
                    <InputMoeda label="Seguro de Vida (Opcional - R$ Mensal)" value={formData.insurance_monthly} onChange={(v) => setFormData(prev => ({ ...prev, insurance_monthly: v }))} />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Índice Correção Monetária</label>
                    <select name="monetary_index" value={formData.monetary_index || 'INCC'} onChange={handleChange} className="w-full bg-surface-2 border border-subtle text-main text-[12px] font-bold rounded-[8px] px-3 h-9 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                        {INDEX_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                <div>
                    <InputPercentual label="Correção Acumulada (%)" value={formData.monetary_correction_accumulated} onChange={(v) => setFormData(prev => ({ ...prev, monetary_correction_accumulated: v }))} />
                </div>

                <div className="col-span-full border-b border-subtle pb-2 mb-1 mt-3">
                    <h3 className="text-[10px] font-black tracking-widest text-faint uppercase">4. Sorteio e Lance</h3>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Status de Contemplação</label>
                    <select name="contemplation_status" value={formData.contemplation_status || 'not_contemplated'} onChange={handleChange} className="w-full bg-surface-2 border border-subtle text-main text-[12px] font-bold rounded-[8px] px-3 h-9 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {formData.contemplation_date && (
                        <p className="text-[9px] text-faint mt-1">Contemplado em {formData.contemplation_date.split('-').reverse().join('/')}</p>
                    )}
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Estratégia de Lance</label>
                    <select name="bid_strategy" value={formData.bid_strategy || 'none'} onChange={handleChange} className="w-full bg-surface-2 border border-subtle text-main text-[12px] font-bold rounded-[8px] px-3 h-9 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                        {STRATEGY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                {formData.bid_strategy !== 'none' && (
                    <div>
                        <InputMoeda label="Valor Estimado do Lance (R$)" value={formData.estimated_bid_value} onChange={(v) => setFormData(prev => ({ ...prev, estimated_bid_value: v || undefined }))} />
                    </div>
                )}
                <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Membros Ativos no Grupo</label>
                    <Input type="number" name="group_size" value={formData.group_size || ''} onChange={handleChange} />
                </div>

                <div className="col-span-full flex flex-col md:flex-row gap-6 mt-2 pt-4 bg-surface-2 p-4 rounded-[8px] border border-subtle">
                    <label className={`flex items-center gap-3 cursor-pointer ${formData.asset_type !== 'real_estate' ? 'opacity-50' : ''}`} title="Apenas válido para imóveis">
                        <input type="checkbox" name="fgts_eligible" checked={formData.fgts_eligible} onChange={handleChange} disabled={formData.asset_type !== 'real_estate'} className="w-5 h-5 rounded border-subtle text-primary focus:ring-primary" />
                        <div>
                            <div className="text-[11px] font-bold text-main uppercase tracking-wider">Elegível ao FGTS</div>
                            <div className="text-[9px] text-faint">Pode usar fundo de garantia para lances</div>
                        </div>
                    </label>

                    <label className={`flex items-center gap-3 cursor-pointer ${formData.contemplation_status === 'not_contemplated' ? 'opacity-50' : ''}`} title="Necessita estar contemplado">
                        <input type="checkbox" name="asset_released" checked={formData.asset_released} onChange={handleChange} disabled={formData.contemplation_status === 'not_contemplated'} className="w-5 h-5 rounded border-subtle text-primary focus:ring-primary" />
                        <div>
                            <div className="text-[11px] font-bold text-main uppercase tracking-wider">Carta Liberada (Ativo Comprado)</div>
                            <div className="text-[9px] text-faint">Recurso do consórcio já foi utilizado</div>
                        </div>
                    </label>
                </div>
            </div>
        </SidePanel>
    );
};

export default ModalFormConsorcio;
