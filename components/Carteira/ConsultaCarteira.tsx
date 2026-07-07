
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { investimentoService } from '../../services/investimentoService';
import { formatarMoeda, normalizarTexto } from '../../utils/formatadores';
import Badge from '../UI/Badge';
import SidePanel from '../UI/SidePanel';
import { Search, Landmark, TrendingUp, Briefcase, Users, ChevronRight } from 'lucide-react';

interface GrupoAtivo {
  chave: string;
  nome: string;
  ticker?: string;
  cnpj?: string;
  origem?: string;
  instituicao?: string;
  itens: any[];
}

const iconePorOrigem = (origem?: string) => {
  if (origem === 'bolsa') return <TrendingUp size={14} />;
  if (origem === 'fundo') return <Briefcase size={14} />;
  return <Landmark size={14} />;
};

const agruparPorAtivo = (ativos: any[]): GrupoAtivo[] => {
  const mapa = new Map<string, GrupoAtivo>();
  ativos.forEach(a => {
    const instituicao = a.bancos_corretoras?.nome;
    const chave = a.ticker || a.cnpj || normalizarTexto(`${a.nome}|${instituicao || ''}`);
    const grupo: GrupoAtivo = mapa.get(chave) || {
      chave, nome: a.nome, ticker: a.ticker, cnpj: a.cnpj, origem: a.origem, instituicao, itens: []
    };
    grupo.itens.push(a);
    mapa.set(chave, grupo);
  });
  return Array.from(mapa.values()).sort((a, b) => b.itens.length - a.itens.length);
};

const ConsultaCarteira: React.FC = () => {
  const navigate = useNavigate();
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [grupoAberto, setGrupoAberto] = useState<GrupoAtivo | null>(null);

  useEffect(() => {
    const t = termo.trim();
    if (t.length < 2) { setResultados([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await investimentoService.buscarAtivosPorTermo(t);
        setResultados(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [termo]);

  const grupos = useMemo(() => agruparPorAtivo(resultados), [resultados]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint pointer-events-none" />
        <input
          type="text"
          value={termo}
          onChange={e => setTermo(e.target.value)}
          placeholder="Buscar por nome, ticker, CNPJ ou instituição..."
          className="w-full pl-9 pr-3 h-9 bg-surface-2 border border-subtle rounded-[8px] outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-[13px] text-main placeholder:text-faint"
        />
      </div>

      {termo.trim().length < 2 ? (
        <div className="py-24 text-center bg-surface-2 border border-dashed border-subtle rounded-xl">
          <Search size={28} className="mx-auto text-faint mb-3" />
          <p className="text-faint text-[12px] font-medium">Digite ao menos 2 caracteres para buscar um ativo entre todos os clientes.</p>
        </div>
      ) : loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[color:var(--primary)]"></div>
          <p className="text-faint text-[11px] font-bold uppercase tracking-widest">Buscando...</p>
        </div>
      ) : grupos.length === 0 ? (
        <div className="py-24 text-center bg-surface-2 border border-dashed border-subtle rounded-xl">
          <p className="text-faint text-[12px] font-medium">Nenhum ativo encontrado para "{termo}".</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-subtle overflow-hidden">
          {grupos.map(g => (
            <button
              key={g.chave}
              onClick={() => setGrupoAberto(g)}
              className="w-full px-5 py-3.5 flex items-center justify-between border-b border-subtle last:border-0 hover:bg-surface-2 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-surface-2 border border-subtle text-faint">
                  {iconePorOrigem(g.origem)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-main text-[13px] leading-none truncate">{g.nome}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {g.ticker && <span className="text-[11px] text-muted font-medium">{g.ticker}</span>}
                    {g.cnpj && <span className="text-[11px] text-faint font-medium">{g.cnpj}</span>}
                    {g.instituicao && <Badge variant="neutral" size="sm">{g.instituicao}</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="primary" size="sm">
                  <Users size={10} className="inline mr-1" />{g.itens.length} cliente{g.itens.length > 1 ? 's' : ''}
                </Badge>
                <ChevronRight size={16} className="text-faint" />
              </div>
            </button>
          ))}
        </div>
      )}

      <SidePanel
        open={!!grupoAberto}
        onClose={() => setGrupoAberto(null)}
        title={grupoAberto?.nome || ''}
        subtitle={grupoAberto ? `${grupoAberto.itens.length} cliente(s) com este ativo` : ''}
        widthClass="max-w-md"
      >
        {grupoAberto && (
          <div className="space-y-1">
            {grupoAberto.itens.map((a: any) => (
              <button
                key={a.id}
                onClick={() => { setGrupoAberto(null); navigate(`/clientes/${a.cliente_id}`); }}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-surface-2 transition-colors border border-transparent hover:border-subtle text-left group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-surface-3 text-muted font-bold flex items-center justify-center text-xs flex-shrink-0">
                    {(a.clientes?.nome || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-main text-[13px] truncate">{a.clientes?.nome || 'Cliente não identificado'}</p>
                    <p className="text-[11px] text-faint">{formatarMoeda(a.valor_atual || 0)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={a.clientes?.status === 'Ativo' ? 'success' : 'neutral'} size="sm">{a.clientes?.status || '—'}</Badge>
                  <ChevronRight size={14} className="text-faint group-hover:text-muted" />
                </div>
              </button>
            ))}
          </div>
        )}
      </SidePanel>
    </div>
  );
};

export default ConsultaCarteira;
