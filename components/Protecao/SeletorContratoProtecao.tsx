import React, { useEffect, useState } from 'react';
import { ContratoProtecao, protecaoService } from '../../services/protecaoService';

interface Props {
    clienteId: string;
    value?: string | null;
    onChange: (contratoId: string | null) => void;
    labelClass: string;
    inputClass: string;
}

/** Vincula a apólice ao contrato extra de proteção que a originou (registrado no prontuário). */
const SeletorContratoProtecao: React.FC<Props> = ({ clienteId, value, onChange, labelClass, inputClass }) => {
    const [contratos, setContratos] = useState<ContratoProtecao[]>([]);

    useEffect(() => {
        protecaoService.getContratosProtecaoCliente(clienteId)
            .then(setContratos)
            .catch(err => console.error('Erro ao carregar contratos de proteção:', err));
    }, [clienteId]);

    // Vínculo com contrato já encerrado continua visível, para não sumir ao editar a apólice.
    const encerrado = !!value && !contratos.some(c => c.id === value);

    return (
        <div>
            <label className={labelClass}>Contrato vinculado (opcional)</label>
            <select value={value || ''} onChange={e => onChange(e.target.value || null)} className={inputClass}>
                <option value="">Sem contrato comigo</option>
                {contratos.map(c => <option key={c.id} value={c.id}>{c.descricao}</option>)}
                {encerrado && <option value={value!}>Contrato encerrado</option>}
            </select>
        </div>
    );
};

export default SeletorContratoProtecao;
