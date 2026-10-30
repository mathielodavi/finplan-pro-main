import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, FileText, Umbrella } from 'lucide-react';
import { GrupoProtecao, ProtecaoCliente, protecaoService } from '../../services/protecaoService';
import { normalizarTexto } from '../../utils/formatadores';
import PainelConsulta, { CarregandoConsulta, VazioConsulta } from '../UI/PainelConsulta';
import Badge from '../UI/Badge';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Filtro = 'todos' | GrupoProtecao;

const ROTULO_GRUPO: Record<GrupoProtecao, string> = {
  sem: 'Sem proteção',
  com_contrato: 'Contrato ativo comigo',
  sem_contrato: 'Sem contrato comigo',
};

const VARIANTE_GRUPO: Record<GrupoProtecao, 'danger' | 'success' | 'info'> = {
  sem: 'danger',
  com_contrato: 'success',
  sem_contrato: 'info',
};

/**
 * Consulta de Proteção — no drawer do KPI "Base com Proteção" (Visão Geral). Tem proteção quem tem
 * apólice vigente ou contrato extra de proteção ativo; os protegidos se dividem entre ter ou não
 * contrato ativo com o planejador. Os avisos apontam o que falta vincular.
 */
const ConsultaProtecaoDrawer: React.FC<Props> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const [termo, setTermo] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [clientes, setClientes] = useState<ProtecaoCliente[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!open) { setTermo(''); setFiltro('todos'); return; }
    let cancelado = false;
    setCarregando(true);
    protecaoService.getProtecaoClientes()
      .then(d => { if (!cancelado) setClientes(d); })
      .catch(err => console.error('Erro ao carregar proteção:', err))
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [open]);

  const contagem = useMemo(() => ({
    sem: clientes.filter(c => c.grupo === 'sem').length,
    com_contrato: clientes.filter(c => c.grupo === 'com_contrato').length,
    sem_contrato: clientes.filter(c => c.grupo === 'sem_contrato').length,
  }), [clientes]);

  const comProtecao = contagem.com_contrato + contagem.sem_contrato;
  const pct = clientes.length > 0 ? (comProtecao / clientes.length) * 100 : 0;

  const alvo = normalizarTexto(termo.trim());
  const lista = useMemo(() => clientes
    .filter(c => filtro === 'todos' || c.grupo === filtro)
    .filter(c => alvo.length < 2 || [
      c.nome,
      ...c.apolices.flatMap(a => [a.rotulo, a.tipo]),
      ...c.contratos.map(ct => ct.descricao),
    ].some(v => normalizarTexto(v).includes(alvo)))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [clientes, filtro, alvo]);

  const abrirCliente = (id: string) => { onClose(); navigate(`/clientes/${id}?aba=protecao`); };

  return (
    <PainelConsulta
      open={open}
      onClose={onClose}
      titulo="Consulta de Proteção"
      subtitulo={`${comProtecao} de ${clientes.length} cliente(s) com proteção · ${pct.toFixed(0)}%`}
      termo={termo}
      onTermo={setTermo}
      placeholder="Buscar por cliente, seguradora ou contrato..."
      opcoes={[
        { id: 'todos', label: `Todos ${clientes.length}` },
        { id: 'sem', label: `Sem proteção ${contagem.sem}` },
        { id: 'com_contrato', label: `Com contrato ${contagem.com_contrato}` },
        { id: 'sem_contrato', label: `Sem contrato ${contagem.sem_contrato}` },
      ]}
      opcaoAtiva={filtro}
      onOpcao={id => setFiltro(id as Filtro)}
    >
      {carregando ? (
        <CarregandoConsulta texto="Carregando proteção..." />
      ) : lista.length === 0 ? (
        <VazioConsulta texto="Nenhum cliente neste filtro." />
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
                  <Badge variant={VARIANTE_GRUPO[c.grupo]} size="sm">{ROTULO_GRUPO[c.grupo]}</Badge>
                  <ChevronRight size={14} className="text-faint group-hover:text-muted" />
                </span>
              </button>

              {(c.contratos.length > 0 || c.apolices.length > 0) && (
                <div className="border-t border-subtle divide-y divide-subtle">
                  {c.contratos.map(ct => (
                    <div key={ct.id} className="flex items-center gap-2 px-3 py-2">
                      <FileText size={13} className="text-[color:var(--primary)] shrink-0" />
                      <span className="text-[12px] font-medium text-main truncate">{ct.descricao}</span>
                    </div>
                  ))}
                  {c.apolices.map(a => (
                    <div key={a.id} className="flex items-center gap-2 px-3 py-2">
                      <Umbrella size={13} className="text-faint shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-[12px] font-medium text-main truncate">{a.rotulo}</span>
                        <span className="block text-[10.5px] text-faint truncate">{a.tipo}{a.contratoId ? ' · vinculada a contrato' : ''}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {(c.contratosSemApolice > 0 || c.apolicesSemVinculo > 0) && (
                <div className="border-t border-subtle px-3 py-2 space-y-1">
                  {c.contratosSemApolice > 0 && (
                    <p className="flex items-center gap-1.5 text-[10.5px] font-medium text-[color:var(--warning)]">
                      <AlertTriangle size={11} className="shrink-0" /> {c.contratosSemApolice} contrato(s) sem apólice vinculada
                    </p>
                  )}
                  {c.apolicesSemVinculo > 0 && (
                    <p className="flex items-center gap-1.5 text-[10.5px] font-medium text-[color:var(--warning)]">
                      <AlertTriangle size={11} className="shrink-0" /> {c.apolicesSemVinculo} apólice(s) sem vínculo com contrato
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PainelConsulta>
  );
};

export default ConsultaProtecaoDrawer;
