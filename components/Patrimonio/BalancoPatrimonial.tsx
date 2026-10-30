import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Car, ChevronRight, Home, Scale, TrendingUp, Wallet } from 'lucide-react';
import { patrimonioService } from '../../services/patrimonioService';
import { BalancoPatrimonial as Balanco, TipoBem } from '../../utils/balanco';
import { formatarMoeda } from '../../utils/formatadores';
import { useProntuarioNav } from '../../context/ProntuarioNavContext';
import BensDrawer from './BensDrawer';

interface Props {
  clienteId: string;
  /** Muda quando a carteira é alterada, para recalcular o balanço. */
  ativos: any[];
  onIrCarteira: () => void;
}

const LinhaBalanco: React.FC<{ icone: React.ReactNode; rotulo: string; dica?: string; valor: number; onClick: () => void }> = ({ icone, rotulo, dica, valor, onClick }) => (
  <button type="button" onClick={onClick} className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left group">
    <span className="flex items-center gap-2.5 min-w-0">
      <span className="text-faint shrink-0">{icone}</span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-main truncate">{rotulo}</span>
        {dica && <span className="block text-[10.5px] text-faint truncate">{dica}</span>}
      </span>
    </span>
    <span className="flex items-center gap-1.5 shrink-0">
      <span className="text-[13px] font-semibold text-main">{formatarMoeda(valor)}</span>
      <ChevronRight size={14} className="text-faint group-hover:text-muted" />
    </span>
  </button>
);

const Grupo: React.FC<{ titulo: string; total: number; children: React.ReactNode }> = ({ titulo, total, children }) => (
  <div className="border-b border-subtle last:border-b-0">
    <div className="flex items-center justify-between px-4 py-2 bg-surface-2/60">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">{titulo}</span>
      <span className="text-[12px] font-bold text-main">{formatarMoeda(total)}</span>
    </div>
    <div className="divide-y divide-subtle">{children}</div>
  </div>
);

const Coluna: React.FC<{ titulo: string; total: number; rotuloTotal: string; children: React.ReactNode }> = ({ titulo, total, rotuloTotal, children }) => (
  <section className="bg-surface rounded-xl border border-subtle overflow-hidden flex flex-col">
    <h3 className="px-4 py-3 border-b border-subtle text-[13px] font-semibold text-main">{titulo}</h3>
    <div className="flex-1">{children}</div>
    <div className="flex items-center justify-between px-4 py-3 border-t border-subtle bg-surface-2">
      <span className="text-[12px] font-semibold text-main">{rotuloTotal}</span>
      <span className="text-[15px] font-bold text-main">{formatarMoeda(total)}</span>
    </div>
  </section>
);

/** Balanço patrimonial do cliente: ativos de um lado, passivos e patrimônio líquido do outro. */
const BalancoPatrimonial: React.FC<Props> = ({ clienteId, ativos, onIrCarteira }) => {
  const { nav } = useProntuarioNav();
  const [balanco, setBalanco] = useState<Balanco | null>(null);
  const [drawerBem, setDrawerBem] = useState<TipoBem | null>(null);

  const carregar = useCallback(async () => {
    try {
      setBalanco(await patrimonioService.getBalanco(clienteId));
    } catch (err) {
      console.error('Erro ao montar o balanço:', err);
    }
  }, [clienteId]);

  useEffect(() => { carregar(); }, [carregar, ativos]);

  if (!balanco) {
    return <div className="py-24 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[color:var(--primary)]" /></div>;
  }

  const irDividas = () => nav?.setActiveTab('dividas');
  const plNegativo = balanco.patrimonioLiquido < 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
      <Coluna titulo="Ativo" total={balanco.totalAtivo} rotuloTotal="Total do ativo">
        <Grupo titulo="Circulante" total={balanco.ativoCirculante}>
          <LinhaBalanco icone={<Wallet size={15} />} rotulo="Financeiro de curto prazo" dica="Ativos de liquidação em curto prazo" valor={balanco.financeiroCurto} onClick={onIrCarteira} />
        </Grupo>
        <Grupo titulo="Não circulante" total={balanco.ativoNaoCirculante}>
          <LinhaBalanco icone={<TrendingUp size={15} />} rotulo="Financeiro de médio e longo prazo" valor={balanco.financeiroLongo} onClick={onIrCarteira} />
          <LinhaBalanco icone={<Home size={15} />} rotulo="Imóveis" valor={balanco.imoveis} onClick={() => setDrawerBem('imovel')} />
          <LinhaBalanco icone={<Car size={15} />} rotulo="Veículos" valor={balanco.veiculos} onClick={() => setDrawerBem('veiculo')} />
          <LinhaBalanco icone={<Building2 size={15} />} rotulo="Empresas" valor={balanco.empresas} onClick={() => setDrawerBem('empresa')} />
        </Grupo>
      </Coluna>

      <Coluna titulo="Passivo e Patrimônio Líquido" total={balanco.totalPassivo + balanco.patrimonioLiquido} rotuloTotal="Total do passivo e PL">
        <Grupo titulo="Circulante" total={balanco.passivoCirculante}>
          <LinhaBalanco icone={<Scale size={15} />} rotulo="Dívidas de curto prazo" dica="Parcelas dos próximos 12 meses" valor={balanco.passivoCirculante} onClick={irDividas} />
        </Grupo>
        <Grupo titulo="Não circulante" total={balanco.passivoNaoCirculante}>
          <LinhaBalanco icone={<Scale size={15} />} rotulo="Dívidas de longo prazo" dica="Saldo devedor após as parcelas de 12 meses" valor={balanco.passivoNaoCirculante} onClick={irDividas} />
        </Grupo>
        <div className="flex items-center justify-between px-4 py-4" style={{ backgroundColor: plNegativo ? 'rgba(248,113,113,0.10)' : 'var(--primary-soft)' }}>
          <span>
            <span className="block text-[13px] font-semibold text-main">Patrimônio Líquido</span>
            <span className="block text-[10.5px] text-muted">Ativos menos passivos</span>
          </span>
          <span className="text-[18px] font-bold" style={{ color: plNegativo ? 'var(--danger)' : 'var(--primary)' }}>{formatarMoeda(balanco.patrimonioLiquido)}</span>
        </div>
      </Coluna>

      <BensDrawer clienteId={clienteId} tipo={drawerBem} onClose={() => setDrawerBem(null)} onAlterado={carregar} />
    </div>
  );
};

export default BalancoPatrimonial;
