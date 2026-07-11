import React from 'react';
import { ClienteSeguro, DependenteSeguro, ParametrosCalculo, SeguroVida } from '../../services/protecaoService';

const fmtMoeda = (v: number) => `R$ ${Math.round(v || 0).toLocaleString('pt-BR')}`;
const fmtDataHoje = () => new Date().toLocaleDateString('pt-BR');
const fmtData = (d?: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const kpiLabel = 'text-[10px] font-semibold text-faint uppercase tracking-wider';
const cardCls = 'bg-surface rounded-xl border border-subtle p-5 sm:p-6 space-y-4';

const DocSectionTitle = ({ numero, titulo }: { numero: string; titulo: string }) => (
  <div className="flex items-center gap-2.5 pb-3 border-b border-subtle">
    <span className="text-[11px] font-mono font-semibold text-faint">{numero}</span>
    <h4 className="text-[13px] font-semibold text-main">{titulo}</h4>
  </div>
);

const CampoKV = ({ label, valor }: { label: string; valor: string }) => (
  <div>
    <span className={kpiLabel}>{label}</span>
    <p className="text-[12px] font-semibold text-main mt-0.5">{valor || '—'}</p>
  </div>
);

const GridCampos = ({ campos }: { campos: [string, string][] }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
    {campos.map(([label, valor]) => <CampoKV key={label} label={label} valor={valor} />)}
  </div>
);

interface TabelaProps {
  cabecalho: string[];
  linhas: (string | React.ReactNode)[][];
  rodape?: (string | React.ReactNode)[];
  corCabecalho?: string;
}

const TabelaRelatorio: React.FC<TabelaProps> = ({ cabecalho, linhas, rodape, corCabecalho }) => (
  <div className="rounded-lg border border-subtle overflow-hidden">
    <table className="w-full text-left border-collapse">
      <thead>
        <tr style={{ backgroundColor: corCabecalho || 'var(--primary)' }}>
          {cabecalho.map((c, i) => (
            <th key={i} className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#0b0e14] ${i > 0 ? 'text-right' : 'text-left'}`}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-subtle">
        {linhas.map((linha, li) => (
          <tr key={li} className={li % 2 === 1 ? 'bg-surface-2' : undefined}>
            {linha.map((cel, ci) => (
              <td key={ci} className={`px-3 py-2 text-[11px] ${ci === 0 ? 'font-semibold text-main' : 'text-muted text-right'}`}>{cel}</td>
            ))}
          </tr>
        ))}
      </tbody>
      {rodape && (
        <tfoot>
          <tr className="bg-surface-3">
            {rodape.map((cel, ci) => (
              <td key={ci} className={`px-3 py-2.5 text-[12px] font-bold text-white ${ci === 0 ? 'text-left' : 'text-right'}`}>{cel}</td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  </div>
);

interface Props {
  dados: ClienteSeguro;
  dependentes: DependenteSeguro[];
  parametros: ParametrosCalculo;
  nomeCliente?: string;
  planejadorNome: string;
  planejadorEmail: string;
  segurosData: SeguroVida[];
  coberturaVida: { coberturaCliente: number; coberturaConjuge: number; coberturaFamiliar: number };
  sucessao: { coberturaSucessao: number; totalFuneral: number; custoInventario: number };
  previdencia: { pgbl: number; vgbl: number };
  totalEducacao: number;
  totalGeral: number;
}

/**
 * Documento do Relatório de Proteção (Levantamento de Necessidade de Proteção) — renderizado
 * como DOM real (não desenhado via primitivas jsPDF) para ser capturado em blocos por
 * `baixarElementoComoPDFPaginado` (utils/pdfFromElement.ts), o mesmo mecanismo do Relatório de
 * Aporte Mensal: cada `data-pdf-block` é uma unidade indivisível na paginação — um bloco que não
 * cabe no espaço restante da página desce inteiro para a próxima, sem cortar tabelas/linhas.
 * Renderizado fora da tela (ver DashboardProtecao.tsx) e só existe para fins de captura do PDF.
 */
const RelatorioProtecaoDoc = React.forwardRef<HTMLDivElement, Props>(({
  dados, dependentes, parametros, nomeCliente, planejadorNome, planejadorEmail,
  segurosData, coberturaVida, sucessao, previdencia, totalEducacao, totalGeral,
}, ref) => {
  const nomeCliente_ = dados.nome_cliente || nomeCliente || 'Cliente';
  const nomeConjuge = dados.nome_conjuge || 'Cônjuge';
  const temConjuge = !!dados.casado_cliente && !!dados.nome_conjuge;
  const depsValidos = dependentes.filter(d => d.nome_dependente?.trim());
  const percEfetivo = (dados.honorarios_perc !== undefined && dados.itcmd_perc !== undefined)
    ? dados.honorarios_perc + dados.itcmd_perc
    : parametros.perc_custos_inventario;
  const contratadoSucessao = segurosData.reduce((acc, s) => acc + (s.cobertura_morte || 0) + (s.cobertura_funeral || 0), 0);

  return (
    <div ref={ref} className="space-y-4 w-[800px] text-main" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Cabeçalho */}
      <div data-pdf-block className="bg-surface rounded-xl border border-subtle px-6 py-6">
        <h3 className="text-[16px] font-semibold text-main">Levantamento de Necessidade de Proteção</h3>
        <p className="text-[12px] text-muted mt-1">Documento para cotação com corretor de seguros</p>
        <p className="text-[11px] text-faint mt-2">
          Planejador: {[planejadorNome, planejadorEmail].filter(Boolean).join(' · ') || '—'} · Emitido em {fmtDataHoje()}
        </p>
      </div>

      {/* 1. Dados pessoais — Cliente */}
      <div data-pdf-block className={cardCls}>
        <DocSectionTitle numero="01" titulo={`Identificação — ${nomeCliente_}`} />
        <GridCampos campos={[
          ['Nome', nomeCliente_],
          ['Data de nascimento', fmtData(dados.data_nascimento_cliente)],
          ['CPF', dados.cpf_cliente || '—'],
          ['Estado civil', dados.casado_cliente ? 'Casado(a)' : 'Solteiro(a)'],
          ['E-mail', dados.email_cliente || '—'],
          ['Telefone', dados.telefone_cliente || '—'],
          ['Estado', dados.estado_cliente || '—'],
          ['Profissão', dados.profissao_cliente || '—'],
          ['Regime de contratação', dados.regime_contratacao_cliente || '—'],
        ]} />
      </div>

      <div data-pdf-block className={cardCls}>
        <DocSectionTitle numero="01" titulo={`Saúde & estilo de vida — ${nomeCliente_}`} />
        <GridCampos campos={[
          ['Fumante', dados.fumante_cliente ? 'Sim' : 'Não'],
          ['Peso (kg)', dados.peso_cliente ? String(dados.peso_cliente) : '—'],
          ['Altura (cm)', dados.altura_cliente ? String(dados.altura_cliente) : '—'],
          ['Esporte/hobby', dados.esporte_hobby_cliente || '—'],
          ['Medicamento contínuo', dados.medicamento_continuo_cliente || '—'],
          ['Doença crônica', dados.doenca_cronica_cliente || '—'],
          ['Cirurgia complexa', dados.cirurgia_complexa_cliente || '—'],
        ]} />
      </div>

      {/* 1. Dados pessoais — Cônjuge */}
      {temConjuge && (
        <>
          <div data-pdf-block className={cardCls}>
            <DocSectionTitle numero="01" titulo={`Identificação — ${nomeConjuge}`} />
            <GridCampos campos={[
              ['Nome', nomeConjuge],
              ['Data de nascimento', fmtData(dados.data_nascimento_conjuge)],
              ['CPF', dados.cpf_conjuge || '—'],
              ['E-mail', dados.email_conjuge || '—'],
              ['Telefone', dados.telefone_conjuge || '—'],
              ['Profissão', dados.profissao_conjuge || '—'],
              ['Regime de contratação', dados.regime_contratacao_conjuge || '—'],
            ]} />
          </div>
          <div data-pdf-block className={cardCls}>
            <DocSectionTitle numero="01" titulo={`Saúde & estilo de vida — ${nomeConjuge}`} />
            <GridCampos campos={[
              ['Fumante', dados.fuma_conjuge ? 'Sim' : 'Não'],
              ['Peso (kg)', dados.peso_conjuge ? String(dados.peso_conjuge) : '—'],
              ['Altura (cm)', dados.altura_conjuge ? String(dados.altura_conjuge) : '—'],
              ['Esporte/hobby', dados.esporte_hobby_conjuge || '—'],
              ['Medicamento contínuo', dados.medicamento_continuo_conjuge || '—'],
              ['Doença crônica', dados.doenca_cronica_conjuge || '—'],
              ['Cirurgia complexa', dados.cirurgia_complexa_conjuge || '—'],
            ]} />
          </div>
        </>
      )}

      {/* 2. Dependentes */}
      <div data-pdf-block className={cardCls}>
        <DocSectionTitle numero="02" titulo="Dependentes" />
        {depsValidos.length > 0 ? (
          <TabelaRelatorio
            cabecalho={['Nome', 'Parentesco', 'Nasc.', 'Cobertura (anos)', 'Auxílio mensal', 'Total calc.']}
            linhas={depsValidos.map(d => [
              d.nome_dependente || '—',
              d.parentesco || '—',
              fmtData(d.data_nascimento_dep),
              String(d.cobertura_anos || 0),
              fmtMoeda(d.auxilio_mensal || 0),
              fmtMoeda(d.total_calculado || 0),
            ])}
          />
        ) : (
          <p className="text-[12px] text-faint">Não possui dependentes cadastrados.</p>
        )}
      </div>

      {/* 3. Padrão de vida e renda */}
      <div data-pdf-block className={cardCls}>
        <DocSectionTitle numero="03" titulo="Padrão de vida e renda" />
        <TabelaRelatorio
          cabecalho={temConjuge ? ['Item', nomeCliente_, nomeConjuge, 'Família'] : ['Item', nomeCliente_]}
          linhas={[
            ['Renda mensal', fmtMoeda(dados.renda_cliente || 0), fmtMoeda(dados.renda_conjuge || 0), fmtMoeda((dados.renda_cliente || 0) + (dados.renda_conjuge || 0))],
            ['Declaração IR', dados.declaracao_ir_cliente || '—', dados.declaracao_ir_conjuge || '—', '—'],
            ['Regime', dados.regime_contratacao_cliente || '—', dados.regime_contratacao_conjuge || '—', '—'],
            ['Período de cobertura', `${dados.periodo_cobertura_anos || 10} anos`, '—', '—'],
            ['Taxa real anual', `${dados.taxa_real_anual ?? 4}%`, '—', '—'],
            ['Despesas obrigatórias', fmtMoeda(dados.despesas_obrigatorias || 0), '—', '—'],
            ['Despesas não obrigatórias', fmtMoeda(dados.despesas_nao_obrigatorias || 0), '—', '—'],
            ['Financiamentos', fmtMoeda(dados.financiamentos || 0), '—', '—'],
            ['Dívidas mensais', fmtMoeda(dados.dividas_mensais || 0), '—', '—'],
            ['Projetos financeiros', fmtMoeda(dados.projetos_financeiros || 0), '—', '—'],
          ].map(linha => temConjuge ? linha : [linha[0], linha[1]])}
        />
      </div>

      {/* 4. Sucessão patrimonial */}
      <div data-pdf-block className={cardCls}>
        <DocSectionTitle numero="04" titulo="Sucessão patrimonial" />
        <TabelaRelatorio
          cabecalho={temConjuge ? ['Item', nomeCliente_, nomeConjuge, 'Família'] : ['Item', nomeCliente_]}
          linhas={[
            ['Funeral / luto', fmtMoeda(dados.funeral_cliente || 0), fmtMoeda(dados.funeral_conjuge || 0), fmtMoeda(sucessao.totalFuneral)],
            [`Bens (invent. ${percEfetivo.toFixed(1)}%)`, fmtMoeda(dados.bens_cliente || 0), fmtMoeda(dados.bens_conjuge || 0), fmtMoeda(sucessao.custoInventario)],
            ['Investimentos líquidos', fmtMoeda(dados.investimentos_cliente || 0), fmtMoeda(dados.investimentos_conjuge || 0), fmtMoeda((dados.investimentos_cliente || 0) + (dados.investimentos_conjuge || 0))],
            ['Dívidas', fmtMoeda(dados.dividas_cliente || 0), fmtMoeda(dados.dividas_conjuge || 0), fmtMoeda((dados.dividas_cliente || 0) + (dados.dividas_conjuge || 0))],
            ['Previdência PGBL (carteira)', '—', '—', fmtMoeda(previdencia.pgbl)],
            ['Previdência VGBL (carteira)', '—', '—', fmtMoeda(previdencia.vgbl)],
            ['Honorários', `${dados.honorarios_perc || 0}%`, '—', '—'],
            ['ITCMD', `${dados.itcmd_perc || 0}%`, '—', '—'],
          ].map(linha => temConjuge ? linha : [linha[0], linha[1]])}
        />
      </div>

      {/* 5. Coberturas recomendadas */}
      <div data-pdf-block className={cardCls}>
        <DocSectionTitle numero="05" titulo="Coberturas de vida recomendadas" />
        <TabelaRelatorio
          cabecalho={['Tipo de cobertura', 'Beneficiário', 'Valor recomendado']}
          linhas={[
            ['Educação e dependentes', 'Família', totalEducacao > 0 ? fmtMoeda(totalEducacao) : 'Não aplicável'],
            ['Padrão de vida', nomeCliente_, coberturaVida.coberturaCliente > 0 ? fmtMoeda(coberturaVida.coberturaCliente) : 'Não aplicável'],
            ...(temConjuge ? [['Padrão de vida', nomeConjuge, coberturaVida.coberturaConjuge > 0 ? fmtMoeda(coberturaVida.coberturaConjuge) : 'Não aplicável']] : []),
            ['Sucessão patrimonial', 'Herdeiros', sucessao.coberturaSucessao > 0 ? fmtMoeda(sucessao.coberturaSucessao) : 'Não aplicável'],
          ]}
          rodape={['Total de cobertura recomendada', '', fmtMoeda(totalGeral)]}
        />
      </div>

      {/* 6. Coberturas cadastradas */}
      {segurosData.length > 0 && (
        <div data-pdf-block className={cardCls}>
          <DocSectionTitle numero="06" titulo="Coberturas de seguro cadastradas" />
          <TabelaRelatorio
            corCabecalho="#a78bfa"
            cabecalho={['Membro', 'Modalidade', 'Morte', 'Funeral', 'Doenças graves', 'Invalidez', 'Cirurgia', 'DIT', 'Mensalidade']}
            linhas={segurosData.map(s => [
              s.membro === 'cliente' ? nomeCliente_ : nomeConjuge,
              s.modalidade === 'grupo' ? 'Grupo' : 'Individual',
              fmtMoeda(s.cobertura_morte || 0),
              fmtMoeda(s.cobertura_funeral || 0),
              fmtMoeda(s.cobertura_doencas_graves || 0),
              fmtMoeda(s.cobertura_invalidez || 0),
              fmtMoeda(s.cobertura_cirurgia || 0),
              fmtMoeda(s.dit || 0),
              fmtMoeda(s.mensalidade || 0),
            ])}
          />
          <p className="text-[10px] text-faint">Cobertura de sucessão já contratada (morte + funeral): {fmtMoeda(contratadoSucessao)}</p>
        </div>
      )}
    </div>
  );
});

RelatorioProtecaoDoc.displayName = 'RelatorioProtecaoDoc';

export default RelatorioProtecaoDoc;
