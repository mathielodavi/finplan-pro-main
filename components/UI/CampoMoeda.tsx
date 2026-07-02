import React, { useState } from 'react';
import { formatarMoeda } from '../../utils/formatadores';

interface Props {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
  autoFocus?: boolean;
}

/** Número → string editável pt-BR (vírgula decimal, sem separador de milhar). */
const paraEdicao = (v: number) => (v ? String(v).replace('.', ',') : '');

/** Interpreta a string digitada (pt-BR) como número, tolerando milhar/decimal. */
export const interpretarNumero = (s: string): number => {
  const limpo = s
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '') // remove pontos de milhar
    .replace(',', '.');
  const n = parseFloat(limpo);
  return isNaN(n) ? 0 : n;
};

/**
 * Campo monetário no padrão "R$ #.##0,00".
 *
 * Vazio → exibe o placeholder de exemplo (some ao digitar). Ao focar, mostra o valor
 * "cru" editável (não reformata a cada tecla, preservando a posição do cursor). Ao sair
 * do campo, formata para exibição e grava o número via onChange.
 */
const CampoMoeda: React.FC<Props> = ({
  value, onChange, placeholder = 'R$ 0,00', disabled, className = '', id, name, required, autoFocus,
}) => {
  const [focado, setFocado] = useState(false);
  const [rascunho, setRascunho] = useState('');

  const exibicao = focado ? rascunho : (value ? formatarMoeda(value) : '');

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode="decimal"
      required={required}
      disabled={disabled}
      autoFocus={autoFocus}
      value={exibicao}
      placeholder={placeholder}
      onFocus={() => { setRascunho(paraEdicao(value)); setFocado(true); }}
      onChange={e => setRascunho(e.target.value)}
      onBlur={() => { onChange(interpretarNumero(rascunho)); setFocado(false); }}
      className={className}
    />
  );
};

export default CampoMoeda;
