import { supabase } from './supabaseClient';
import { dividasService } from './dividasService';
import { investimentoService } from './investimentoService';
import { indexadoresService, IndiceMercado } from './indexadoresService';
import { calcularSaldoEParcelasAtual, parcelasProximos12Meses, taxaCorrecaoEfetiva } from '../utils/calculosDividas';
import { BalancoPatrimonial, DividaBalanco, TipoBem, montarBalanco } from '../utils/balanco';
import { DividaConsorcio, DividaCredito } from '../types/dividas';

export interface BemPatrimonial {
  id?: string;
  cliente_id: string;
  tipo: TipoBem;
  descricao: string;
  valor: number;
  observacoes?: string | null;
}

const dividasDoBalanco = async (creditos: DividaCredito[], consorcios: DividaConsorcio[]): Promise<DividaBalanco[]> => {
  const indices = creditos
    .map(c => c.monetary_index)
    .filter((i): i is IndiceMercado => !!i && i !== 'fixed' && i !== 'none');
  const mercado = await indexadoresService.getTaxasMercado(indices);

  return [
    ...creditos.map(c => {
      const comTaxa = { ...c, monetary_correction_effective: taxaCorrecaoEfetiva(c, mercado) };
      return { saldo: calcularSaldoEParcelasAtual(comTaxa).saldoDevedor, parcelas12Meses: parcelasProximos12Meses(comTaxa) };
    }),
    ...consorcios.map(c => ({
      saldo: Math.max(0, (Number(c.credit_letter_value) || 0) - (Number(c.total_paid_to_date) || 0)),
      parcelas12Meses: (Number(c.current_installment_value) || 0) * Math.min(12, Number(c.remaining_installments) || 0),
    })),
  ];
};

export const patrimonioService = {
  async getBens(clienteId: string): Promise<BemPatrimonial[]> {
    const { data, error } = await supabase.from('bens_patrimoniais').select('*').eq('cliente_id', clienteId).order('descricao');
    if (error) throw error;
    return data || [];
  },

  async salvarBem(bem: BemPatrimonial): Promise<BemPatrimonial> {
    const { id, ...campos } = bem;
    const consulta = id
      ? supabase.from('bens_patrimoniais').update(campos).eq('id', id)
      : supabase.from('bens_patrimoniais').insert(campos);
    const { data, error } = await consulta.select().single();
    if (error) throw error;
    return data;
  },

  async excluirBem(id: string): Promise<void> {
    const { error } = await supabase.from('bens_patrimoniais').delete().eq('id', id);
    if (error) throw error;
  },

  /** Balanço do cliente: mesma fonte dos KPIs da aba Estratégia e da tela Resumo de Patrimônio. */
  async getBalanco(clienteId: string): Promise<BalancoPatrimonial> {
    const [ativos, bens, creditos, consorcios] = await Promise.all([
      investimentoService.getAtivos(clienteId),
      this.getBens(clienteId),
      dividasService.getCreditos(clienteId),
      dividasService.getConsorcios(clienteId),
    ]);
    return montarBalanco(ativos || [], bens, await dividasDoBalanco(creditos || [], consorcios || []));
  },
};
