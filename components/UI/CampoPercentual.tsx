import React, { useState } from 'react';
import { formatarPercentual } from '../../utils/formatadores';
import { interpretarNumero } from './CampoMoeda';

interface Props {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
  /** Limite superior (padrão 100). Passe undefined para não limitar. */
  max?: number;
}

const paraEdicao = (v: number) => (v ? String(v).replace('.', ',') : '');

/**
 * Campo percentual no padrão "#0,00%". Mesmo comportamento de foco/blur do CampoMoeda:
 * placeholder de exemplo quando vazio, valor cru editável ao focar (sem pulo de cursor)
 * e formatação ao sair. Aplica clamp em [0, max] (max padrão 100).
 */
const CampoPercentual: React.FC<Props> = ({
  value, onChange, placeholder = '0,00%', disabled, className = '', id, name, required, max = 100,
}) => {
  const [focado, setFocado] = useState(false);
  const [rascunho, setRascunho] = useState('');

  const exibicao = focado ? rascunho : (value ? formatarPercentual(value) : '');

  const finalizar = () => {
    let n = interpretarNumero(rascunho);
    if (n < 0) n = 0;
    if (typeof max === 'number' && n > max) n = max;
    onChange(n);
    setFocado(false);
  };

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode="decimal"
      required={required}
      disabled={disabled}
      value={exibicao}
      placeholder={placeholder}
      onFocus={() => { setRascunho(paraEdicao(value)); setFocado(true); }}
      onChange={e => setRascunho(e.target.value)}
      onBlur={finalizar}
      className={className}
    />
  );
};

export default CampoPercentual;
