import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, CreditCard } from 'lucide-react';
import { dividasService, DividasCliente } from '../../services/dividasService';
import { formatarMoeda, normalizarTexto } from '../../utils/formatadores';
import PainelConsulta, { CarregandoConsulta, VazioConsulta } from '../UI/PainelConsulta';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Ordem = 'alfabetica' | 'saldo';

/**
 * Consulta de Endividamento — dívidas de todos os clientes ativos, no drawer do KPI "Endividamento
 * Total" (Visão Geral). Busca em memória por cliente, instituição, dívida ou tipo; com busca ativa,
 * mostra sob cada cliente as dívidas que casaram.
 */
const ConsultaDividasDrawer: React.FC<Props> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const [termo, setTermo] = useState('');
  const [ordem, setOrdem] = useState<Ordem>('saldo');
  const [clientes, setClientes] = useState<DividasCliente[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!open) { setTermo(''); return; }
    let cancelado = false;
    setCarregando(true);
    dividasService.getDividasClientes()
      .then(d => { if (!cancelado) setClientes(d); })
      .catch(err => console.error('Erro ao carregar dívidas:', err))
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [open]);

  const alvo = normalizarTexto(termo.trim());
  const buscaAtiva = alvo.length >= 2;

  const lista = useMemo(() => {
    const filtrados = !buscaAtiva ? clientes : clientes.flatMap(c => {
      const casaCliente = normalizarTexto(c.nome).includes(alvo);
      const linhas = c.linhas.filter(l =>
        [l.rotulo, l.tipo, l.instituicao].some(v => normalizarTexto(v).includes(alvo)));
      if (!casaCliente && linhas.length === 0) return [];
      return [casaCliente ? c : { ...c, linhas, saldo: linhas.reduce((acc, l) => acc + l.saldo, 0) }];
    });
    return [...filtrados].sort((a, b) => ordem === 'alfabetica' ? a.nome.localeCompare(b.nome, 'pt-BR') : b.saldo - a.saldo);
  }, [clientes, alvo, buscaAtiva, ordem]);

  const total = useMemo(() => lista.reduce((acc, c) => acc + c.saldo, 0), [lista]);

  const abrirCliente = (id: string) => { onClose(); navigate(`/clientes/${id}?aba=dividas`); };

  return (
    <PainelConsulta
      open={open}
      onClose={onClose}
      titulo="Consulta de Endividamento"
      subtitulo={`${lista.length} cliente(s) · ${formatarMoeda(total)}`}
      termo={termo}
      onTermo={setTermo}
      placeholder="Buscar por cliente, instituição, dívida ou tipo..."
      opcoes={[{ id: 'alfabetica', label: 'Ordem alfabética' }, { id: 'saldo', label: 'Maior saldo' }]}
      opcaoAtiva={ordem}
      onOpcao={id => setOrdem(id as Ordem)}
    >
      {carregando ? (
        <CarregandoConsulta texto="Carregando dívidas..." />
      ) : lista.length === 0 ? (
        <VazioConsulta texto={buscaAtiva ? `Nenhuma dívida corresponde a "${termo.trim()}".` : 'Nenhum cliente ativo com dívida cadastrada.'} />
      ) : (
        <div className="space-y-2">
          {lista.map(c => (
            <div key={c.id} className="bg-surface-2 rounded-lg border border-subtle overflow-hidden">
              <button
                type="button"
                onClick={() => abrirCliente(c.id)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-surface-3 transition-colors text-left group"
              >
                <span className="text-[13px] font-semibold text-main truncate">{c.nome}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[13px] font-bold text-[color:var(--danger)]">{formatarMoeda(c.saldo)}</span>
                  <ChevronRight size={14} className="text-faint group-hover:text-muted" />
                </span>
              </button>
              <div className="border-t border-subtle divide-y divide-subtle">
                {c.linhas.map(l => (
                  <div key={l.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <CreditCard size={13} className="text-faint shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-[12px] font-medium text-main truncate">{l.rotulo}</span>
                        <span className="block text-[10.5px] text-faint truncate">{[l.tipo, l.instituicao].filter(Boolean).join(' · ')}</span>
                      </span>
                    </span>
                    <span className="text-[12px] font-semibold text-muted shrink-0">{formatarMoeda(l.saldo)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </PainelConsulta>
  );
};

export default ConsultaDividasDrawer;
