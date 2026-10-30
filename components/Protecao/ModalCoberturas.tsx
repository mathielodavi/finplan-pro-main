import React from 'react';
import { Settings } from 'lucide-react';
import Modal from '../Modal';
import { PlanoSaude, SeguroExtra, SeguroVida } from '../../services/protecaoService';
import { LinhaProtecao, MembroProtecao, SEGUROS_DE_BENS, TIPO_SEGURO_PROFISSIONAL, apoliceVigente } from '../../utils/protecaoTabela';
import { formatarData, formatarMoeda } from '../../utils/formatadores';

interface Props {
  linha: LinhaProtecao | null;
  onClose: () => void;
  onGerenciar: (linha: LinhaProtecao) => void;
  /** Visão aberta: chave do membro, ou null para a família. */
  membro: string | null;
  membros: MembroProtecao[];
  hoje: string;
  planos: PlanoSaude[];
  seguros: SeguroVida[];
  extras: SeguroExtra[];
  ativos: any[];
}

interface Coluna { titulo: string; direita?: boolean }

const Tabela: React.FC<{ colunas: Coluna[]; linhas: React.ReactNode[][]; vazio: string }> = ({ colunas, linhas, vazio }) => (
  linhas.length === 0 ? (
    <p className="py-8 text-center text-[12px] font-medium text-faint">{vazio}</p>
  ) : (
    <div className="border border-subtle rounded-lg overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-surface-2 border-b border-subtle">
            {colunas.map(c => (
              <th key={c.titulo} className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-faint whitespace-nowrap ${c.direita ? 'text-right' : ''}`}>{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-subtle">
          {linhas.map((celulas, i) => (
            <tr key={i}>
              {celulas.map((c, j) => (
                <td key={j} className={`px-3 py-2 text-[12px] font-medium text-main whitespace-nowrap ${colunas[j].direita ? 'text-right' : ''}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
);

/** Lista o que está contratado em uma linha da tabela de proteção. */
const ModalCoberturas: React.FC<Props> = ({ linha, onClose, onGerenciar, membro, membros, hoje, planos, seguros, extras, ativos }) => {
  if (!linha) return null;

  const nomeMembro = (chave?: string | null) => membros.find(m => m.chave === chave)?.nome || chave || '—';
  const doMembro = <T extends { membro?: string | null }>(lista: T[]) => membro ? lista.filter(a => a.membro === membro) : lista;
  const vencimento = (a: { fim_vigencia?: string | null }) => {
    if (!a.fim_vigencia) return '—';
    return `${formatarData(a.fim_vigencia)}${apoliceVigente(a, hoje) ? '' : ' · vencida'}`;
  };

  const conteudo = () => {
    if (linha.detalhe === 'reserva') {
      const vinculados = ativos.flatMap(a => {
        const link = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === 'reserva');
        return link ? [{ a, percentual: Number(link.percentual) || 0 }] : [];
      });
      return (
        <Tabela
          colunas={[{ titulo: 'Ativo' }, { titulo: 'Valor', direita: true }, { titulo: 'Vinculado', direita: true }, { titulo: 'Na reserva', direita: true }]}
          linhas={vinculados.map(({ a, percentual }) => [
            a.nome, formatarMoeda(a.valor_atual || 0), `${percentual}%`, formatarMoeda((a.valor_atual || 0) * percentual / 100),
          ])}
          vazio="Nenhum ativo vinculado à reserva de emergência."
        />
      );
    }

    if (linha.detalhe === 'plano') {
      return (
        <Tabela
          colunas={[{ titulo: 'Membro' }, { titulo: 'Operadora' }, { titulo: 'Cobertura' }, { titulo: 'Vencimento' }, { titulo: 'Mensalidade', direita: true }]}
          linhas={doMembro(planos).map(p => [nomeMembro(p.membro), p.operadora || '—', p.cobertura || '—', vencimento(p), formatarMoeda(p.mensalidade || 0)])}
          vazio="Nenhum plano de saúde contratado."
        />
      );
    }

    if (linha.detalhe === 'vida') {
      const soma = (s: SeguroVida) => linha.id === 'vida_padrao'
        ? (s.cobertura_doencas_graves || 0) + (s.cobertura_invalidez || 0) + (s.cobertura_cirurgia || 0) + (s.dit || 0)
        : (s.cobertura_morte || 0) + (s.cobertura_funeral || 0);
      return (
        <Tabela
          colunas={[{ titulo: 'Membro' }, { titulo: 'Seguradora' }, { titulo: 'Vencimento' }, { titulo: 'Cobertura', direita: true }, { titulo: 'Mensalidade', direita: true }]}
          linhas={doMembro(seguros).map(s => [nomeMembro(s.membro), s.seguradora || '—', vencimento(s), formatarMoeda(soma(s)), formatarMoeda(s.mensalidade || 0)])}
          vazio="Nenhuma apólice de seguro de vida contratada."
        />
      );
    }

    const tipo = linha.detalhe === 'profissional'
      ? TIPO_SEGURO_PROFISSIONAL
      : SEGUROS_DE_BENS.find(s => s.id === linha.detalhe)?.tipoSeguro;
    const apolices = linha.detalhe === 'profissional' ? doMembro(extras) : extras;
    return (
      <Tabela
        colunas={[{ titulo: 'Descrição' }, { titulo: 'Vencimento' }, { titulo: 'Cobertura', direita: true }, { titulo: 'Mensalidade', direita: true }]}
        linhas={apolices.filter(e => e.tipo_seguro === tipo).map(e => [
          e.descricao || e.tipo_seguro || '—', vencimento(e),
          e.valor_cobertura ? formatarMoeda(e.valor_cobertura) : 'Não informado', formatarMoeda(e.mensalidade || 0),
        ])}
        vazio="Nenhuma apólice contratada."
      />
    );
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={linha.protecao}
      subtitle={linha.pilar}
      size="xl"
      headerActions={(
        <button
          type="button"
          onClick={() => onGerenciar(linha)}
          className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-colors"
        >
          <Settings size={13} /> {linha.detalhe === 'reserva' ? 'Configurar' : 'Gerenciar'}
        </button>
      )}
    >
      {conteudo()}
    </Modal>
  );
};

export default ModalCoberturas;
