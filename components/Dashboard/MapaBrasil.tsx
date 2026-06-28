import React from 'react';
import { MapPin } from 'lucide-react';

interface EstadoDado {
  estado: string;
  ativos: number;
  inativos: number;
  total: number;
}

interface Props {
  dados: EstadoDado[];
}

/** Posições aproximadas (não cartográficas) dos estados brasileiros em um viewBox 0–100. */
const POSICOES: Record<string, { x: number; y: number }> = {
  RR: { x: 24, y: 8 }, AP: { x: 42, y: 10 }, AM: { x: 18, y: 28 }, PA: { x: 38, y: 26 },
  AC: { x: 8, y: 42 }, RO: { x: 20, y: 48 }, TO: { x: 47, y: 44 },
  MA: { x: 50, y: 26 }, PI: { x: 56, y: 30 }, CE: { x: 64, y: 22 }, RN: { x: 70, y: 20 },
  PB: { x: 71, y: 25 }, PE: { x: 68, y: 29 }, AL: { x: 70, y: 33 }, SE: { x: 69, y: 36 }, BA: { x: 60, y: 44 },
  MT: { x: 34, y: 46 }, MS: { x: 38, y: 62 }, GO: { x: 49, y: 54 }, DF: { x: 51, y: 51 },
  MG: { x: 55, y: 60 }, ES: { x: 64, y: 60 }, RJ: { x: 60, y: 67 }, SP: { x: 51, y: 68 },
  PR: { x: 47, y: 74 }, SC: { x: 47, y: 82 }, RS: { x: 43, y: 90 },
};

const MapaBrasil: React.FC<Props> = ({ dados }) => {
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

  const maxTotal = Math.max(1, ...dados.map(d => d.total));
  const radius = (total: number) => 2.4 + (total / maxTotal) * 5.4;

  return (
    <div className="w-full h-full flex flex-col flex-1">
      <svg viewBox="0 0 100 100" className="w-full flex-1">
        <defs>
          <filter id="mapaBrasilBlur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <ellipse cx="45" cy="50" rx="38" ry="46" fill="rgba(16,185,129,0.06)" filter="url(#mapaBrasilBlur)" />
        <text x="45" y="53" textAnchor="middle" fontSize="9" fontWeight={700} fill="rgba(255,255,255,0.07)" letterSpacing="2">
          BRASIL
        </text>
        {dados.map(d => {
          const pos = POSICOES[d.estado];
          if (!pos) return null;
          const r = radius(d.total);
          const dominante = d.ativos >= d.inativos ? 'var(--primary)' : 'var(--danger)';
          return (
            <g key={d.estado}>
              <circle cx={pos.x} cy={pos.y} r={r} fill={dominante} fillOpacity={0.22} stroke={dominante} strokeWidth={0.6} />
              <circle cx={pos.x} cy={pos.y} r={1.3} fill={dominante} />
              <title>{`${d.estado}: ${d.ativos} ativo(s) · ${d.inativos} inativo(s)`}</title>
            </g>
          );
        })}
      </svg>
      <div className="flex justify-center gap-4 mt-1 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
          <span className="text-[11px] font-medium text-muted">Maioria ativos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--danger)' }} />
          <span className="text-[11px] font-medium text-muted">Maioria inativos</span>
        </div>
      </div>
    </div>
  );
};

export default MapaBrasil;
