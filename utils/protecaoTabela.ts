import { TipoBem } from './balanco';

export type DetalheProtecao = 'reserva' | 'plano' | 'vida' | 'imobiliario' | 'veicular' | 'empresarial' | 'profissional';

export interface LinhaProtecao {
  id: string;
  protecao: string;
  pilar: string;
  vencimento: string | null;
  vencido: boolean;
  /** Número é valor em reais; texto é exibido como está; null vira "—". */
  recomendado: number | string | null;
  contratado: number | string | null;
  detalhe: DetalheProtecao;
}

export interface MembroProtecao { chave: string; nome: string }

interface ApoliceBase { fim_vigencia?: string | null; membro?: string | null }

export interface EntradaProtecao {
  hoje: string;
  membros: MembroProtecao[];
  reservaIdeal: number;
  saldoReserva: number;
  planos: ApoliceBase[];
  seguros: (ApoliceBase & {
    cobertura_morte?: number; cobertura_funeral?: number; cobertura_doencas_graves?: number;
    cobertura_invalidez?: number; cobertura_cirurgia?: number; dit?: number;
  })[];
  extras: (ApoliceBase & { tipo_seguro?: string; valor_cobertura?: number | null })[];
  bens: { tipo: TipoBem; valor?: number | null }[];
  necessidade: { educacao: number; padraoVidaCliente: number; padraoVidaConjuge: number; sucessao: number };
}

/** Linhas de seguro de bem: aparecem quando há o bem ou uma apólice do tipo. */
export const SEGUROS_DE_BENS: { id: DetalheProtecao; protecao: string; pilar: string; tipoBem: TipoBem; tipoSeguro: string }[] = [
  { id: 'imobiliario', protecao: 'Seguro Imobiliário', pilar: 'Proteção patrimonial', tipoBem: 'imovel', tipoSeguro: 'Residencial' },
  { id: 'veicular', protecao: 'Seguro Veicular', pilar: 'Proteção patrimonial', tipoBem: 'veiculo', tipoSeguro: 'Automotivo' },
  { id: 'empresarial', protecao: 'Seguro Empresarial', pilar: 'Proteção empresarial', tipoBem: 'empresa', tipoSeguro: 'Empresarial' },
];

export const TIPO_SEGURO_PROFISSIONAL = 'Responsabilidade Civil';

export const apoliceVigente = (a: { fim_vigencia?: string | null }, hoje: string) => !a.fim_vigencia || a.fim_vigencia >= hoje;

/** Vencimento mais próximo entre as vigentes; sem vigente, o último que já passou. */
const vencimentoDe = (apolices: ApoliceBase[], hoje: string): { vencimento: string | null; vencido: boolean } => {
  const datas = apolices.map(a => a.fim_vigencia).filter((d): d is string => !!d).sort();
  const proxima = datas.find(d => d >= hoje);
  if (proxima) return { vencimento: proxima, vencido: false };
  if (apolices.some(a => !a.fim_vigencia) || datas.length === 0) return { vencimento: null, vencido: false };
  return { vencimento: datas[datas.length - 1], vencido: true };
};

const somaSucessao = (seguros: EntradaProtecao['seguros']) =>
  seguros.reduce((acc, s) => acc + (s.cobertura_morte || 0) + (s.cobertura_funeral || 0), 0);
const somaPadraoVida = (seguros: EntradaProtecao['seguros']) =>
  seguros.reduce((acc, s) => acc + (s.cobertura_doencas_graves || 0) + (s.cobertura_invalidez || 0) + (s.cobertura_cirurgia || 0) + (s.dit || 0), 0);

const contratadoExtras = (extras: EntradaProtecao['extras'], hoje: string): number | string => {
  const total = extras.filter(e => apoliceVigente(e, hoje)).reduce((acc, e) => acc + (Number(e.valor_cobertura) || 0), 0);
  return total > 0 || extras.length === 0 ? total : 'Valor não informado';
};

const linhaProfissional = (extras: EntradaProtecao['extras'], hoje: string): LinhaProtecao => ({
  id: 'profissional',
  protecao: 'Proteção Profissional',
  pilar: 'Proteção profissional',
  ...vencimentoDe(extras, hoje),
  recomendado: null,
  contratado: contratadoExtras(extras, hoje),
  detalhe: 'profissional',
});

/** Proteção global da família. */
export const linhasFamilia = (e: EntradaProtecao): LinhaProtecao[] => {
  const { hoje, necessidade } = e;
  const segurosVigentes = e.seguros.filter(s => apoliceVigente(s, hoje));
  const venctoVida = vencimentoDe(e.seguros, hoje);
  const comPlano = new Set(e.planos.filter(p => apoliceVigente(p, hoje)).map(p => p.membro));
  const totalMembros = e.membros.length;
  const cobertos = e.membros.filter(m => comPlano.has(m.chave)).length;
  const vida = (id: string, pilar: string, recomendado: number, contratado: number): LinhaProtecao =>
    ({ id, protecao: 'Seguro de Vida', pilar, ...venctoVida, recomendado, contratado, detalhe: 'vida' });

  const linhas: LinhaProtecao[] = [
    {
      id: 'reserva', protecao: 'Reserva de Emergência', pilar: 'Proteção ativa', vencimento: null, vencido: false,
      recomendado: e.reservaIdeal, contratado: e.saldoReserva, detalhe: 'reserva',
    },
    {
      id: 'plano', protecao: 'Plano de Saúde', pilar: 'Proteção de saúde', ...vencimentoDe(e.planos, hoje),
      recomendado: `${totalMembros} ${totalMembros === 1 ? 'membro' : 'membros'}`,
      contratado: `${cobertos} de ${totalMembros}`, detalhe: 'plano',
    },
    vida('vida_educacao', 'Educação e dependentes', necessidade.educacao, somaSucessao(segurosVigentes)),
    vida('vida_padrao', 'Padrão de vida', necessidade.padraoVidaCliente + necessidade.padraoVidaConjuge, somaPadraoVida(segurosVigentes)),
    vida('vida_sucessao', 'Sucessão patrimonial', necessidade.sucessao, somaSucessao(segurosVigentes)),
  ];

  SEGUROS_DE_BENS.forEach(s => {
    const bens = e.bens.filter(b => b.tipo === s.tipoBem);
    const apolices = e.extras.filter(x => x.tipo_seguro === s.tipoSeguro);
    if (bens.length === 0 && apolices.length === 0) return;
    linhas.push({
      id: s.id, protecao: s.protecao, pilar: s.pilar, ...vencimentoDe(apolices, hoje),
      recomendado: bens.reduce((acc, b) => acc + (Number(b.valor) || 0), 0),
      contratado: contratadoExtras(apolices, hoje), detalhe: s.id,
    });
  });

  const profissional = e.extras.filter(x => x.tipo_seguro === TIPO_SEGURO_PROFISSIONAL);
  if (profissional.length > 0) linhas.push(linhaProfissional(profissional, hoje));
  return linhas;
};

/**
 * O que protege um familiar. Educação e Sucessão são necessidades da família, por isso só o
 * Padrão de Vida tem recomendado individual, e só para titular e cônjuge.
 */
export const linhasMembro = (e: EntradaProtecao, membro: string): LinhaProtecao[] => {
  const { hoje, necessidade } = e;
  const planos = e.planos.filter(p => p.membro === membro);
  const planosVigentes = planos.filter(p => apoliceVigente(p, hoje));
  const seguros = e.seguros.filter(s => s.membro === membro);
  const vigentes = seguros.filter(s => apoliceVigente(s, hoje));
  const venctoVida = vencimentoDe(seguros, hoje);
  const principal = membro === 'cliente' || membro === 'conjuge';
  const padraoVida = membro === 'cliente' ? necessidade.padraoVidaCliente : necessidade.padraoVidaConjuge;
  const vida = (id: string, pilar: string, recomendado: number | null, contratado: number): LinhaProtecao =>
    ({ id, protecao: 'Seguro de Vida', pilar, ...venctoVida, recomendado, contratado, detalhe: 'vida' });

  const linhas: LinhaProtecao[] = [{
    id: 'plano', protecao: 'Plano de Saúde', pilar: 'Proteção de saúde', ...vencimentoDe(planos, hoje),
    recomendado: '1 plano',
    contratado: planosVigentes.length > 0 ? `${planosVigentes.length} ${planosVigentes.length === 1 ? 'plano' : 'planos'}` : 'Nenhum',
    detalhe: 'plano',
  }];

  if (principal || seguros.length > 0) {
    linhas.push(
      vida('vida_educacao', 'Educação e dependentes', null, somaSucessao(vigentes)),
      vida('vida_padrao', 'Padrão de vida', principal ? padraoVida : null, somaPadraoVida(vigentes)),
      vida('vida_sucessao', 'Sucessão patrimonial', null, somaSucessao(vigentes)),
    );
  }

  const profissional = e.extras.filter(x => x.tipo_seguro === TIPO_SEGURO_PROFISSIONAL && x.membro === membro);
  if (profissional.length > 0) linhas.push(linhaProfissional(profissional, hoje));
  return linhas;
};
