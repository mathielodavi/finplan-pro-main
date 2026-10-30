import React, { useState } from 'react';
import { SeguroExtra, protecaoService } from '../../services/protecaoService';
import { MembroProtecao, TIPO_SEGURO_PROFISSIONAL } from '../../utils/protecaoTabela';
import CampoMonetario from './CampoMonetario';
import FormModalApolice, { inpApolice as inp, lblApolice as lbl } from './FormModalApolice';
import SeletorContratoProtecao from './SeletorContratoProtecao';

const TIPOS = [
    { valor: 'Residencial', rotulo: 'Seguro Imobiliário' },
    { valor: 'Automotivo', rotulo: 'Seguro Veicular' },
    { valor: 'Empresarial', rotulo: 'Seguro Empresarial' },
    { valor: TIPO_SEGURO_PROFISSIONAL, rotulo: 'Proteção Profissional' },
];

interface Props {
    clienteId: string;
    membros: MembroProtecao[];
    /** Apólice em edição, ou os valores iniciais de uma nova. */
    seguro: Partial<SeguroExtra>;
    onCancelar: () => void;
    onSalvo: () => void;
}

/** Seguros de bens e proteção profissional, todos gravados em `seguros_extras`. */
const FormSeguroExtra: React.FC<Props> = ({ clienteId, membros, seguro, onCancelar, onSalvo }) => {
    const [form, setForm] = useState<Partial<SeguroExtra>>(seguro);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const profissional = form.tipo_seguro === TIPO_SEGURO_PROFISSIONAL;
    const rotulo = TIPOS.find(t => t.valor === form.tipo_seguro)?.rotulo || 'Seguro';

    const salvar = async () => {
        if (!form.tipo_seguro) {
            setErro('Selecione o tipo de seguro antes de salvar.');
            return;
        }
        setSalvando(true);
        setErro(null);
        try {
            await protecaoService.upsertSeguroExtra({
                ...form,
                cliente_id: clienteId,
                membro: profissional ? form.membro || null : null,
                inicio_vigencia: form.inicio_vigencia || null,
                fim_vigencia: form.fim_vigencia || null,
            } as SeguroExtra);
            onSalvo();
        } catch (err: any) {
            setErro('Erro ao salvar seguro: ' + (err?.message || 'tente novamente.'));
            setSalvando(false);
        }
    };

    return (
        <FormModalApolice titulo={`${form.id ? 'Editar' : 'Adicionar'} ${rotulo}`} erro={erro} salvando={salvando} onCancelar={onCancelar} onSalvar={salvar}>
            <div className="grid grid-cols-1 gap-4">
                <div>
                    <label className={lbl}>Tipo de Seguro</label>
                    <select value={form.tipo_seguro || ''} onChange={e => setForm(f => ({ ...f, tipo_seguro: e.target.value }))} className={inp}>
                        <option value="">Selecione...</option>
                        {TIPOS.map(t => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
                    </select>
                </div>
                <div>
                    <label className={lbl}>Descrição / Cobertura</label>
                    <input value={form.descricao || ''} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className={inp} placeholder="Ex: Casa da Praia, Veículo Família, Consultório..." />
                </div>
                {profissional && (
                    <div>
                        <label className={lbl}>Titular</label>
                        <select value={form.membro || ''} onChange={e => setForm(f => ({ ...f, membro: e.target.value || null }))} className={inp}>
                            <option value="">Não informado</option>
                            {membros.map(m => <option key={m.chave} value={m.chave}>{m.nome}</option>)}
                        </select>
                    </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={lbl}>Início da Vigência</label>
                        <input type="date" value={form.inicio_vigencia || ''} onChange={e => setForm(f => ({ ...f, inicio_vigencia: e.target.value }))} className={inp} />
                    </div>
                    <div>
                        <label className={lbl}>Fim da Vigência</label>
                        <input type="date" value={form.fim_vigencia || ''} onChange={e => setForm(f => ({ ...f, fim_vigencia: e.target.value }))} className={inp} />
                    </div>
                </div>
                <SeletorContratoProtecao clienteId={clienteId} value={form.contrato_id} onChange={v => setForm(f => ({ ...f, contrato_id: v }))} labelClass={lbl} inputClass={inp} />
                <div className="grid grid-cols-2 gap-3">
                    <CampoMonetario label="Valor de cobertura (R$)" value={form.valor_cobertura || 0} onChange={v => setForm(f => ({ ...f, valor_cobertura: v }))} />
                    <CampoMonetario label="Mensalidade (R$)" value={form.mensalidade || 0} onChange={v => setForm(f => ({ ...f, mensalidade: v }))} />
                </div>
            </div>
        </FormModalApolice>
    );
};

export default FormSeguroExtra;
