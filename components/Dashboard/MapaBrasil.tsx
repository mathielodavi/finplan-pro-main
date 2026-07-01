import React from 'react';
import { MapPin } from 'lucide-react';
import { BRASIL_ESTADOS, BRASIL_VIEWBOX } from '../../utils/brasilEstadosPaths';

interface ClienteResumo {
  id: string;
  nome: string;
}

interface EstadoDado {
  estado: string;
  ativos: number;
  inativos: number;
  total: number;
  clientes?: ClienteResumo[];
}

interface Props {
  dados: EstadoDado[];
  onSelectEstado?: (estado: string, clientes: ClienteResumo[]) => void;
}

const MapaBrasil: React.FC<Props> = ({ dados, onSelectEstado }) => {
  if (dados.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-faint">
        <MapPin size={22} className="opacity-50" />
        <p className="text-[12px] font-medium text-center px-4">
          Nenhum cliente com estado cadastrado ainda.
        </p>
      </div>
    );
  }

  const porEstado = new Map(dados.map(d => [d.estado, d]));
  const maxTotal = Math.max(1, ...dados.map(d => d.total));

  return (
    <div className="w-full h-full flex flex-col flex-1 min-h-0">
      <div className="relative flex-1 min-h-0">
        <svg viewBox={BRASIL_VIEWBOX} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full">
        {BRASIL_ESTADOS.map(uf => {
          const d = porEstado.get(uf.id);
          const total = d?.total || 0;
          const intensidade = total > 0 ? 0.18 + (total / maxTotal) * 0.82 : 0;
          const clicavel = !!onSelectEstado && (d?.clientes?.length || 0) > 0;
          return (
            <path
              key={uf.id}
              d={uf.path}
              fill={total > 0 ? 'var(--primary)' : 'rgba(255,255,255,0.04)'}
              fillOpacity={total > 0 ? intensidade : 1}
              stroke="rgba(255,255,255,0.14)"
              strokeWidth={0.25}
              onClick={() => clicavel && onSelectEstado!(uf.id, d!.clientes || [])}
              style={{ cursor: clicavel ? 'pointer' : 'default', transition: 'fill-opacity 0.2s' }}
            >
              <title>{`${uf.nome}: ${d?.ativos || 0} ativo(s) · ${d?.inativos || 0} inativo(s)`}</title>
            </path>
          );
        })}
        </svg>
      </div>
      <div className="flex items-center justify-center gap-2 mt-1 flex-shrink-0">
        <span className="text-[11px] font-medium text-faint">Menos clientes</span>
        <div className="flex h-2 w-24 rounded-full overflow-hidden">
          {[0.2, 0.4, 0.6, 0.8, 1].map(op => (
            <div key={op} className="flex-1 h-full" style={{ backgroundColor: 'var(--primary)', opacity: op }} />
          ))}
        </div>
        <span className="text-[11px] font-medium text-faint">Mais clientes</span>
      </div>
    </div>
  );
};

export default MapaBrasil;
