import React from 'react';
import { MapPin } from 'lucide-react';

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

/** Contorno estilizado (não cartográfico) do território brasileiro, no mesmo viewBox 0–100 das posições acima. */
const CONTORNO_PONTOS: [number, number][] = [
  [20, 5], [35, 4], [48, 8], [54, 18], [62, 16], [74, 18], [74, 27], [71, 34],
  [64, 42], [66, 55], [62, 64], [54, 71], [49, 78], [47, 86], [41, 95],
  [33, 90], [33, 68], [28, 50], [14, 46], [10, 30], [10, 14],
];

function caminhoSuavizado(pontos: [number, number][]): string {
  const n = pontos.length;
  const meio = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = meio(pontos[n - 1], pontos[0]);
  let d = `M ${m0[0].toFixed(1)} ${m0[1].toFixed(1)} `;
  for (let i = 0; i < n; i++) {
    const proximo = pontos[(i + 1) % n];
    const m = meio(pontos[i], proximo);
    d += `Q ${pontos[i][0]} ${pontos[i][1]} ${m[0].toFixed(1)} ${m[1].toFixed(1)} `;
  }
  return d + 'Z';
}

const CONTORNO_BRASIL = caminhoSuavizado(CONTORNO_PONTOS);

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

  const maxTotal = Math.max(1, ...dados.map(d => d.total));
  const radius = (total: number) => 2.6 + (total / maxTotal) * 5.2;

  return (
    <div className="w-full h-full flex flex-col flex-1">
      <svg viewBox="0 0 100 100" className="w-full flex-1">
        <path d={CONTORNO_BRASIL} fill="rgba(16,185,129,0.07)" stroke="rgba(16,185,129,0.22)" strokeWidth={0.6} />
        {dados.map(d => {
          const pos = POSICOES[d.estado];
          if (!pos) return null;
          const r = radius(d.total);
          const dominante = d.ativos >= d.inativos ? 'var(--primary)' : 'var(--danger)';
          const clicavel = !!onSelectEstado && (d.clientes?.length || 0) > 0;
          return (
            <g
              key={d.estado}
              onClick={() => clicavel && onSelectEstado!(d.estado, d.clientes || [])}
              style={{ cursor: clicavel ? 'pointer' : 'default' }}
            >
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
