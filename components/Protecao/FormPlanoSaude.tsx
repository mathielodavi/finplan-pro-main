import React, { useState } from 'react';
import { PlanoSaude, protecaoService } from '../../services/protecaoService';
import { MembroProtecao } from '../../utils/protecaoTabela';
import CampoMonetario from './CampoMonetario';
import FormModalApolice, { inpApolice as inp, lblApolice as lbl } from './FormModalApolice';
import SeletorContratoProtecao from './SeletorContratoProtecao';

const COBERTURAS_INCLUIDAS = [
    { key: 'coparticipacao', label: 'Coparticipação', desc: 'Possui coparticipação nos procedimentos' },
    { key: 'uti', label: 'UTI', desc: 'Cobre internação em UTI' },
    { key: 'quarto_privativo', label: 'Quarto Privativo', desc: 'Internação em quarto individual' },
    { key: 'obstetricia', label: 'Obstetrícia', desc: 'Cobre partos e procedimentos obstétricos' },
] as const;

interface Props {
    clienteId: string;
    membros: MembroProtecao[];
    /** Plano em edição, ou os valores iniciais de um novo. */
    plano: Partial<PlanoSaude>;
    onCancelar: () => void;
    onSalvo: () => void;
}

const FormPlanoSaude: React.FC<Props> = ({ clienteId, membros, plano, onCancelar, onSalvo }) => {
    const [form, setForm] = useState<Partial<PlanoSaude>>({ cobertura: 'Nacional', mensalidade: 0, ...plano });
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const salvar = async () => {
        if (!form.membro || !form.operadora) {
            setErro('Preencha ao menos o membro e a operadora antes de salvar.');
            return;
        }
        setSalvando(true);
        setErro(null);
        try {
            await protecaoService.upsertPlanoSaude({ ...form, cliente_id: clienteId, fim_vigencia: form.fim_vigencia || null } as PlanoSaude);
            onSalvo();
        } catch (err: any) {
            setErro('Erro ao salvar plano de saúde: ' + (err?.message || 'tente novamente.'));
            setSalvando(false);
        }
    };

    return (
        <FormModalApolice titulo={`${form.id ? 'Editar' : 'Novo'} Plano de Saúde`} erro={erro} salvando={salvando} onCancelar={onCancelar} onSalvar={salvar}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className={lbl}>Membro</label>
                    <select value={form.membro} onChange={e => setForm(f => ({ ...f, membro: e.target.value }))} className={inp}>
                        {membros.map(m => <option key={m.chave} value={m.chave}>{m.nome}</option>)}
                    </select>
                </div>
                <div>
                    <label className={lbl}>Operadora</label>
                    <input value={form.operadora || ''} onChange={e => setForm(f => ({ ...f, operadora: e.target.value }))} className={inp} placeholder="Ex: Unimed, Bradesco..." />
                </div>
                <div>
                    <label className={lbl}>Cobertura</label>
                    <select value={form.cobertura || 'Nacional'} onChange={e => setForm(f => ({ ...f, cobertura: e.target.value }))} className={inp}>
                        <option>Nacional</option><option>Estadual</option><option>Municipal</option>
                    </select>
                </div>
                <CampoMonetario label="Mensalidade (R$)" value={form.mensalidade || 0} onChange={v => setForm(f => ({ ...f, mensalidade: v }))} />
                <div>
                    <label className={lbl}>Vencimento</label>
                    <input type="date" value={form.fim_vigencia || ''} onChange={e => setForm(f => ({ ...f, fim_vigencia: e.target.value }))} className={inp} />
                </div>
                <div className="md:col-span-2">
                    <SeletorContratoProtecao clienteId={clienteId} value={form.contrato_id} onChange={v => setForm(f => ({ ...f, contrato_id: v }))} labelClass={lbl} inputClass={inp} />
                </div>
            </div>

            <div>
                <p className={lbl}>Coberturas incluídas</p>
                {COBERTURAS_INCLUIDAS.map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between py-2.5 border-b border-subtle last:border-0">
                        <div>
                            <p className="text-[12px] font-bold text-main tracking-tight">{label}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-faint">{desc}</p>
                        </div>
                        <button type="button"
                            onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${form[key] ? 'bg-[color:var(--primary)]' : 'bg-surface-3'}`}>
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-surface shadow transition-transform ${form[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                ))}
            </div>
        </FormModalApolice>
    );
};

export default FormPlanoSaude;
