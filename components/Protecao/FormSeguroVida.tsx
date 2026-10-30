import React, { useState } from 'react';
import { SeguroVida, protecaoService } from '../../services/protecaoService';
import { MembroProtecao } from '../../utils/protecaoTabela';
import CampoMonetario from './CampoMonetario';
import FormModalApolice, { inpApolice as inp, lblApolice as lbl } from './FormModalApolice';
import SeletorContratoProtecao from './SeletorContratoProtecao';

interface Props {
    clienteId: string;
    membros: MembroProtecao[];
    /** Apólice em edição, ou os valores iniciais de uma nova. */
    seguro: Partial<SeguroVida>;
    onCancelar: () => void;
    onSalvo: () => void;
}

const FormSeguroVida: React.FC<Props> = ({ clienteId, membros, seguro, onCancelar, onSalvo }) => {
    const [form, setForm] = useState<Partial<SeguroVida>>({ modalidade: 'individual', ...seguro });
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const salvar = async () => {
        if (!form.membro) return;
        setSalvando(true);
        setErro(null);
        try {
            await protecaoService.upsertSeguroVida({
                ...form,
                cliente_id: clienteId,
                inicio_vigencia: form.inicio_vigencia || null,
                fim_vigencia: form.fim_vigencia || null,
            } as SeguroVida);
            onSalvo();
        } catch (err: any) {
            setErro('Erro ao salvar seguro: ' + (err?.message || 'tente novamente.'));
            setSalvando(false);
        }
    };

    const campoMonetario = (label: string, campo: keyof SeguroVida) => (
        <CampoMonetario
            label={label}
            value={(form[campo] as number) || 0}
            onChange={v => setForm(f => ({ ...f, [campo]: v }))}
        />
    );

    return (
        <FormModalApolice titulo={`${form.id ? 'Editar' : 'Novo'} Seguro de Vida`} erro={erro} salvando={salvando} onCancelar={onCancelar} onSalvar={salvar}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={lbl}>Membro</label>
                    <select value={form.membro} onChange={e => setForm(f => ({ ...f, membro: e.target.value }))} className={inp}>
                        {membros.map(m => <option key={m.chave} value={m.chave}>{m.nome}</option>)}
                    </select>
                </div>
                <div>
                    <label className={lbl}>Modalidade</label>
                    <div className="flex bg-surface-2 p-1 rounded-[8px] border border-subtle h-9">
                        <button type="button" onClick={() => setForm(f => ({ ...f, modalidade: 'individual' }))} className={`flex-1 rounded-[6px] font-bold text-[10px] uppercase tracking-wider transition-all ${form.modalidade !== 'grupo' ? 'bg-surface text-[color:var(--primary)] shadow-sm' : 'text-faint'}`}>Individual</button>
                        <button type="button" onClick={() => setForm(f => ({ ...f, modalidade: 'grupo' }))} className={`flex-1 rounded-[6px] font-bold text-[10px] uppercase tracking-wider transition-all ${form.modalidade === 'grupo' ? 'bg-surface text-[color:var(--info)] shadow-sm' : 'text-faint'}`}>Grupo</button>
                    </div>
                </div>
                <div className="md:col-span-2">
                    <label className={lbl}>Seguradora</label>
                    <input value={form.seguradora || ''} onChange={e => setForm(f => ({ ...f, seguradora: e.target.value }))} className={inp} placeholder="Ex: Porto Seguro, Itaú Vida..." />
                </div>
                <div className="md:col-span-2">
                    <SeletorContratoProtecao clienteId={clienteId} value={form.contrato_id} onChange={v => setForm(f => ({ ...f, contrato_id: v }))} labelClass={lbl} inputClass={inp} />
                </div>
            </div>

            <div className="space-y-3">
                <p className="text-[10px] font-bold text-faint uppercase tracking-wider border-b border-subtle pb-2">Padrão de Vida</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {campoMonetario('Doenças Graves', 'cobertura_doencas_graves')}
                    {campoMonetario('Invalidez', 'cobertura_invalidez')}
                    {campoMonetario('Cirurgia', 'cobertura_cirurgia')}
                    {campoMonetario('DIT (diária)', 'dit')}
                </div>
            </div>

            <div className="space-y-3">
                <p className="text-[10px] font-bold text-faint uppercase tracking-wider border-b border-subtle pb-2">Sucessão</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {campoMonetario('Morte', 'cobertura_morte')}
                    {campoMonetario('Funeral', 'cobertura_funeral')}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={lbl}>Início da Vigência</label>
                    <input type="date" value={form.inicio_vigencia || ''} onChange={e => setForm(f => ({ ...f, inicio_vigencia: e.target.value }))} className={inp} />
                </div>
                <div>
                    <label className={lbl}>Fim da Vigência</label>
                    <input type="date" value={form.fim_vigencia || ''} onChange={e => setForm(f => ({ ...f, fim_vigencia: e.target.value }))} className={inp} />
                </div>
                {campoMonetario('Mensalidade (R$)', 'mensalidade')}
            </div>
        </FormModalApolice>
    );
};

export default FormSeguroVida;
