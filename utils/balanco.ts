export type PrazoLiquidacao = 'curto' | 'longo';
export type TipoBem = 'imovel' | 'veiculo' | 'empresa';

/** Regra inicial: classe Caixa ou ativo vinculado à reserva de emergência liquida no curto prazo. */
export const prazoPadraoAtivo = (ativo: { tipo_ativo?: string | null; distribuicao_objetivos?: any[] | null }): PrazoLiquidacao => {
  const naReserva = (ativo.distribuicao_objetivos || []).some((o: any) => o.tipo === 'reserva' && Number(o.percentual) > 0);
  return ativo.tipo_ativo === 'Caixa' || naReserva ? 'curto' : 'longo';
};

export const prazoDoAtivo = (ativo: { prazo_liquidacao?: string | null; tipo_ativo?: string | null; distribuicao_objetivos?: any[] | null }): PrazoLiquidacao =>
  ativo.prazo_liquidacao === 'curto' || ativo.prazo_liquidacao === 'longo' ? ativo.prazo_liquidacao : prazoPadraoAtivo(ativo);

export interface DividaBalanco {
  saldo: number;
  /** Soma das parcelas dos próximos 12 meses. */
  parcelas12Meses: number;
}

export interface BalancoPatrimonial {
  financeiroCurto: number;
  financeiroLongo: number;
  imoveis: number;
  veiculos: number;
  empresas: number;
  ativoCirculante: number;
  ativoNaoCirculante: number;
  totalAtivo: number;
  passivoCirculante: number;
  passivoNaoCirculante: number;
  totalPassivo: number;
  patrimonioLiquido: number;
}

const somar = <T,>(lista: T[], valor: (item: T) => number) => lista.reduce((acc, item) => acc + valor(item), 0);

/**
 * Parcelas incluem juros futuros e o saldo devedor não: o circulante é limitado ao saldo de cada
 * dívida e o não circulante é o restante, para o passivo total fechar com o saldo devedor.
 */
export const montarBalanco = (
  ativos: { valor_atual?: number | null; prazo_liquidacao?: string | null; tipo_ativo?: string | null; distribuicao_objetivos?: any[] | null }[],
  bens: { tipo: TipoBem; valor?: number | null }[],
  dividas: DividaBalanco[],
): BalancoPatrimonial => {
  const valorAtivo = (a: { valor_atual?: number | null }) => Number(a.valor_atual) || 0;
  const financeiroCurto = somar(ativos.filter(a => prazoDoAtivo(a) === 'curto'), valorAtivo);
  const financeiroLongo = somar(ativos.filter(a => prazoDoAtivo(a) === 'longo'), valorAtivo);
  const totalBem = (tipo: TipoBem) => somar(bens.filter(b => b.tipo === tipo), b => Number(b.valor) || 0);
  const imoveis = totalBem('imovel');
  const veiculos = totalBem('veiculo');
  const empresas = totalBem('empresa');

  const ativoCirculante = financeiroCurto;
  const ativoNaoCirculante = financeiroLongo + imoveis + veiculos + empresas;
  const totalAtivo = ativoCirculante + ativoNaoCirculante;
  const passivoCirculante = somar(dividas, d => Math.min(Math.max(0, d.saldo), Math.max(0, d.parcelas12Meses)));
  const totalPassivo = somar(dividas, d => Math.max(0, d.saldo));
  const passivoNaoCirculante = totalPassivo - passivoCirculante;

  return {
    financeiroCurto, financeiroLongo, imoveis, veiculos, empresas,
    ativoCirculante, ativoNaoCirculante, totalAtivo,
    passivoCirculante, passivoNaoCirculante, totalPassivo,
    patrimonioLiquido: totalAtivo - totalPassivo,
  };
};
