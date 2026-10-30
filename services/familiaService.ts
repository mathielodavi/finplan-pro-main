import { supabase } from './supabaseClient';
import { ClienteSeguro, protecaoService } from './protecaoService';

export const PARENTESCO_CONJUGE = 'Cônjuge';
export const PARENTESCOS = [PARENTESCO_CONJUGE, 'Filho(a)', 'Enteado(a)', 'Pai', 'Mãe', 'Irmão/Irmã', 'Outro'];

export interface Familiar {
  id?: string;
  cliente_id: string;
  parentesco: string;
  nome: string;
  data_nascimento?: string | null;
  telefone?: string | null;
  email?: string | null;
  estado?: string | null;
  cpf?: string | null;
  profissao?: string | null;
  cobertura_anos?: number | null;
  auxilio_mensal?: number | null;
  total_calculado?: number | null;
  ordem?: number;
}

const TABELAS_COM_MEMBRO = ['planos_saude', 'seguros_vida', 'seguros_extras'];

/** Chave usada na coluna `membro` das apólices. */
export const membroDoFamiliar = (f: Pick<Familiar, 'parentesco' | 'nome'>) =>
  f.parentesco === PARENTESCO_CONJUGE ? 'conjuge' : f.nome;

/** Cálculos, score e PDF leem a identificação do cônjuge de `clientes_seguros`. */
const espelharConjuge = async (clienteId: string, conjuge: Familiar | null) => {
  await protecaoService.getOrCreate(clienteId);
  await protecaoService.update(clienteId, conjuge ? identidadeDoConjuge(conjuge) : { casado_cliente: false });
};

/** Campos de `clientes_seguros` que refletem o cônjuge cadastrado na família. */
export const identidadeDoConjuge = (conjuge: Familiar): Partial<ClienteSeguro> => ({
  casado_cliente: true,
  nome_conjuge: conjuge.nome,
  data_nascimento_conjuge: conjuge.data_nascimento ?? null,
  telefone_conjuge: conjuge.telefone ?? null,
  email_conjuge: conjuge.email ?? null,
  estado_conjuge: conjuge.estado ?? null,
  cpf_conjuge: conjuge.cpf ?? null,
  profissao_conjuge: conjuge.profissao ?? null,
} as Partial<ClienteSeguro>);

const atualizarMembroNasApolices = async (clienteId: string, de: string, para: string) => {
  for (const tabela of TABELAS_COM_MEMBRO) {
    const { error } = await supabase.from(tabela).update({ membro: para }).eq('cliente_id', clienteId).eq('membro', de);
    if (error) throw error;
  }
};

const contarApolices = async (clienteId: string, membro: string) => {
  const contagens = await Promise.all(TABELAS_COM_MEMBRO.map(async tabela => {
    const { count, error } = await supabase.from(tabela).select('id', { count: 'exact', head: true })
      .eq('cliente_id', clienteId).eq('membro', membro);
    if (error) throw error;
    return count || 0;
  }));
  return contagens.reduce((acc, n) => acc + n, 0);
};

export const familiaService = {
  async listar(clienteId: string): Promise<Familiar[]> {
    const { data, error } = await supabase.from('clientes_familiares').select('*')
      .eq('cliente_id', clienteId).order('ordem').order('criado_em');
    if (error) throw error;
    return data || [];
  },

  /** `anterior` é o registro antes da edição, usado para manter as apólices ligadas ao membro. */
  async salvar(familiar: Familiar, anterior?: Familiar): Promise<Familiar> {
    const { id, ...campos } = familiar;
    const consulta = id
      ? supabase.from('clientes_familiares').update(campos).eq('id', id)
      : supabase.from('clientes_familiares').insert(campos);
    const { data, error } = await consulta.select().single();
    if (error) {
      if (error.code === '23505') throw new Error('Este cliente já tem um cônjuge cadastrado.');
      throw error;
    }

    if (anterior && membroDoFamiliar(anterior) !== membroDoFamiliar(data)) {
      await atualizarMembroNasApolices(familiar.cliente_id, membroDoFamiliar(anterior), membroDoFamiliar(data));
    }
    if (data.parentesco === PARENTESCO_CONJUGE) await espelharConjuge(familiar.cliente_id, data);
    else if (anterior?.parentesco === PARENTESCO_CONJUGE) await espelharConjuge(familiar.cliente_id, null);
    return data;
  },

  async remover(familiar: Familiar): Promise<void> {
    const apolices = await contarApolices(familiar.cliente_id, membroDoFamiliar(familiar));
    if (apolices > 0) {
      throw new Error(`${familiar.nome} tem ${apolices} apólice(s) em Proteção. Exclua ou transfira antes de remover.`);
    }
    const { error } = await supabase.from('clientes_familiares').delete().eq('id', familiar.id);
    if (error) throw error;
    if (familiar.parentesco === PARENTESCO_CONJUGE) await espelharConjuge(familiar.cliente_id, null);
  },
};
