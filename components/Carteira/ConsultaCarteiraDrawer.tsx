import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { investimentoService } from '../../services/investimentoService';
import { formatarMoeda, normalizarTexto } from '../../utils/formatadores';
import SidePanel from '../UI/SidePanel';
import { Search, Landmark, TrendingUp, Briefcase, ChevronRight } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Ordem = 'alfabetica' | 'patrimonio';

/** Linha exibida sob o cliente quando há busca: um ativo que casou, ou uma instituição agregada. */
interface LinhaMatch {
  chave: string;
  rotulo: string;
  sub?: string;
  valor: number;
  origem?: string;
  ehInstituicao?: boolean;
}

interface ClienteResultado {
  id: string;
  nome: string;
  total: number;
  linhas: LinhaMatch[];
}

const iconePorOrigem = (origem?: string) => {
  if (origem === 'bolsa') return <TrendingUp size={13} />;
  if (origem === 'fundo') return <Briefcase size={13} />;
  return <Landmark size={13} />;
};

const segBtn = (active: boolean) =>
  `flex-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${active ? 'bg-surface-3 text-primary' : 'text-faint hover:text-muted'}`;

/**
 * Consulta de Carteira — busca um ativo entre as carteiras de TODOS os clientes.
 * Vive no drawer do KPI "Patrimônio sob Gestão" (Visão Geral) para dar acesso rápido; antes era
 * uma aba da tela de Carteira Recomendada.
 *
 * Sem busca: lista os clientes ativos com carteira cadastrada (patrimônio + tese).
 * Com busca: agrupa por cliente, somando o saldo dos ativos que casaram. Quando o termo casa com
 * a INSTITUIÇÃO (e não com o ativo), a linha exibida é a instituição com o total investido nela.
 */
const ConsultaCarteiraDrawer: React.FC<Props> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const [termo, setTermo] = useState('');
  const [ordem, setOrdem] = useState<Ordem>('patrimonio');
  const [carteiras, setCarteiras] = useState<any[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [resultados, setResultados] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);

  const termoLimpo = termo.trim();
  const buscaAtiva = termoLimpo.length >= 2;

  // Lista base (clientes ativos com carteira) — recarrega a cada abertura.
  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    setCarregandoLista(true);
    investimentoService.getCarteirasClientes()
      .then(d => { if (!cancelado) setCarteiras(d || []); })
      .catch(err => console.error('Erro ao carregar carteiras:', err))
      .finally(() => { if (!cancelado) setCarregandoLista(false); });
    return () => { cancelado = true; };
  }, [open]);

  // Limpa o estado ao fechar, para a próxima abertura começar do zero.
  useEffect(() => { if (!open) { setTermo(''); setResultados([]); } }, [open]);

  // Busca com debounce (mesmo comportamento da Consulta de Carteira original).
  useEffect(() => {
    if (!buscaAtiva) { setResultados([]); return; }
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        setResultados(await investimentoService.buscarAtivosPorTermo(termoLimpo));
      } catch (err) {
        console.error(err);
      } finally {
        setBuscando(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [termoLimpo, buscaAtiva]);

  // Agrupa os ativos encontrados por cliente, separando match de ativo x match de instituição.
  const clientesEncontrados = useMemo<ClienteResultado[]>(() => {
    if (!buscaAtiva) return [];
    const alvo = normalizarTexto(termoLimpo);
    const porCliente = new Map<string, ClienteResultado & { instituicoes: Map<string, number> }>();

    resultados.forEach(a => {
      const clienteId = a.cliente_id;
      if (!clienteId) return;
      const valor = Number(a.valor_atual) || 0;
      const instituicao: string | undefined = a.bancos_corretoras?.nome;
      const casaAtivo = [a.nome, a.ticker, a.cnpj].some(v => v && normalizarTexto(String(v)).includes(alvo));
      const casaInstituicao = !!instituicao && normalizarTexto(instituicao).includes(alvo);
      if (!casaAtivo && !casaInstituicao) return;

      const atual = porCliente.get(clienteId) || {
        id: clienteId,
        nome: a.clientes?.nome || 'Cliente não identificado',
        total: 0,
        linhas: [] as LinhaMatch[],
        instituicoes: new Map<string, number>(),
      };

      if (casaAtivo) {
        atual.linhas.push({
          chave: a.id,
          rotulo: a.nome || '—',
          sub: a.ticker || a.cnpj || undefined,
          valor,
          origem: a.origem,
        });
      } else if (instituicao) {
        // Casou pela instituição: agrega o saldo por instituição em vez de listar cada ativo.
        atual.instituicoes.set(instituicao, (atual.instituicoes.get(instituicao) || 0) + valor);
      }
      atual.total += valor;
      porCliente.set(clienteId, atual);
    });

    return Array.from(porCliente.values()).map(c => ({
      id: c.id,
      nome: c.nome,
      total: c.total,
      linhas: [
        ...c.linhas,
        ...Array.from(c.instituicoes.entries()).map(([nome, valor]) => ({
          chave: `inst-${nome}`, rotulo: nome, valor, ehInstituicao: true,
        })),
      ],
    }));
  }, [resultados, termoLimpo, buscaAtiva]);

  const ordenar = <T extends { nome: string }>(lista: T[], valorDe: (item: T) => number) =>
    [...lista].sort((a, b) => ordem === 'alfabetica'
      ? a.nome.localeCompare(b.nome, 'pt-BR')
      : valorDe(b) - valorDe(a));

  const listaBase = useMemo(() => ordenar(carteiras, c => c.patrimonio), [carteiras, ordem]);
  const listaBusca = useMemo(() => ordenar(clientesEncontrados, c => c.total), [clientesEncontrados, ordem]);

  const abrirCliente = (id: string) => { onClose(); navigate(`/clientes/${id}`); };

  const totalBase = useMemo(() => carteiras.reduce((acc, c) => acc + (c.patrimonio || 0), 0), [carteiras]);

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title="Consulta de Carteira"
      subtitle={buscaAtiva
        ? `${listaBusca.length} cliente(s) com o ativo buscado`
        : `${carteiras.length} cliente(s) · ${formatarMoeda(totalBase)}`}
      widthClass="max-w-lg"
    >
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint pointer-events-none" />
          <input
            type="text"
            value={termo}
            onChange={e => setTermo(e.target.value)}
            placeholder="Buscar por nome, ticker, CNPJ ou instituição..."
            className="w-full pl-9 pr-3 h-10 bg-surface-2 border border-subtle rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-[13px] text-main placeholder:text-faint"
          />
        </div>

        <div className="flex bg-surface-2 p-0.5 rounded-lg border border-subtle">
          <button type="button" onClick={() => setOrdem('alfabetica')} className={segBtn(ordem === 'alfabetica')}>Ordem alfabética</button>
          <button type="button" onClick={() => setOrdem('patrimonio')} className={segBtn(ordem === 'patrimonio')}>Maior patrimônio</button>
        </div>

        {buscaAtiva ? (
          buscando ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[color:var(--primary)]" />
              <p className="text-faint text-[11px] font-bold uppercase tracking-widest">Buscando...</p>
            </div>
          ) : listaBusca.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-faint text-[12px]">Nenhum cliente possui ativo correspondente a "{termoLimpo}".</p>
            </div>
          ) : (
            <div className="space-y-2">
              {listaBusca.map(c => (
                <div key={c.id} className="bg-surface-2 rounded-lg border border-subtle overflow-hidden">
                  <button
                    type="button"
                    onClick={() => abrirCliente(c.id)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-surface-3 transition-colors text-left group"
                  >
                    <span className="text-[13px] font-semibold text-main truncate">{c.nome}</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[13px] font-bold text-primary">{formatarMoeda(c.total)}</span>
                      <ChevronRight size={14} className="text-faint group-hover:text-muted" />
                    </span>
                  </button>
                  <div className="border-t border-subtle divide-y divide-subtle">
                    {c.linhas.map(l => (
                      <div key={l.chave} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-faint shrink-0">
                            {l.ehInstituicao ? <Landmark size={13} /> : iconePorOrigem(l.origem)}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[12px] font-medium text-main truncate">{l.rotulo}</span>
                            {(l.sub || l.ehInstituicao) && (
                              <span className="block text-[10.5px] text-faint truncate">
                                {l.ehInstituicao ? 'Instituição' : l.sub}
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="text-[12px] font-semibold text-muted shrink-0">{formatarMoeda(l.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : carregandoLista ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[color:var(--primary)]" />
            <p className="text-faint text-[11px] font-bold uppercase tracking-widest">Carregando carteiras...</p>
          </div>
        ) : listaBase.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-faint text-[12px]">Nenhum cliente ativo com carteira de investimentos cadastrada.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-subtle divide-y divide-subtle overflow-hidden">
            {listaBase.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => abrirCliente(c.id)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-surface-2 transition-colors text-left group"
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-main truncate">{c.nome}</span>
                  <span className="block text-[11px] text-faint truncate">{c.estrategia || 'Sem tese definida'}</span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[13px] font-bold text-main">{formatarMoeda(c.patrimonio)}</span>
                  <ChevronRight size={14} className="text-faint group-hover:text-muted" />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </SidePanel>
  );
};

export default ConsultaCarteiraDrawer;
