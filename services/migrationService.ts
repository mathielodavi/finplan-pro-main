
import { supabase } from './supabaseClient';

export interface MigrationPayload {
  clientes: any[];
  reunioes: any[];
  contratos: any[];
  financeiro_parcelas: any[];
  padroes_contrato?: {
    planejamento: any[];
    extra: any[];
  };
}

export const migrationService = {
  getTemplate(): MigrationPayload {
    return {
      clientes: [
        {
          id_antigo: "CLI-001",
          nome: "Nome do Cliente",
          patrimonio_total: 500000,
          aporte_mensal: 2500,
          status: "Ativo",
          status_atendimento: "Acompanhamento",
          observacoes: "Notas sobre o cliente"
        }
      ],
      reunioes: [
        {
          cliente_id_antigo: "CLI-001",
          data_reuniao: "2024-01-20T14:30:00Z",
          notas: "Discussão de carteira",
          status: "realizada"
        }
      ],
      contratos: [
        {
          id_antigo: "CON-001",
          cliente_id_antigo: "CLI-001",
          tipo: "planejamento",
          descricao: "Consultoria Anual",
          valor: 12000,
          prazo_meses: 12,
          repasse_percentual: 100,
          data_inicio: "2024-01-01",
          status: "ativo"
        }
      ],
      financeiro_parcelas: [
        {
          contrato_id_antigo: "CON-001",
          cliente_id_antigo: "CLI-001",
          valor_previsto: 1000,
          valor_pago: 1000,
          data_vencimento: "2024-01-10",
          data_pagamento: "2024-01-08T10:00:00Z",
          status: "pago"
        }
      ]
    };
  },

  async executeMigration(data: MigrationPayload, consultantMap: Record<string, string>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const empresaId = user.user_metadata?.empresa_id || user.id;
    const clientMap: Record<string, string> = {};
    const contractMap: Record<string, string> = {};

    // 1. IMPORTAR CLIENTES
    for (const cli of data.clientes) {
      const { data: newCli, error } = await supabase
        .from('clientes')
        .insert([{
          nome: cli.nome,
          patrimonio_total: cli.patrimonio_total || 0,
          aporte_mensal: cli.aporte_mensal || 0,
          consultor_id: user.id, // Migra tudo para o consultor atual por padrão
          empresa_id: empresaId,
          status: cli.status || 'Ativo',
          status_atendimento: cli.status_atendimento,
          observacoes: cli.observacoes,
          criado_em: cli.criado_em || new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) console.error("Erro cliente:", error);
      else if (cli.id_antigo) clientMap[cli.id_antigo] = newCli.id;
    }

    // 2. IMPORTAR REUNIOES
    const reunioesPayload = data.reunioes
      .filter(r => clientMap[r.cliente_id_antigo])
      .map(r => ({
        cliente_id: clientMap[r.cliente_id_antigo],
        data_reuniao: r.data_reuniao,
        notas: r.notas,
        status: r.status || 'realizada'
      }));

    if (reunioesPayload.length > 0) {
      await supabase.from('reunioes').insert(reunioesPayload);
    }

    // 3. IMPORTAR CONTRATOS
    for (const con of data.contratos) {
      if (!clientMap[con.cliente_id_antigo]) continue;

      const { data: newCon, error } = await supabase
        .from('contratos')
        .insert([{
          cliente_id: clientMap[con.cliente_id_antigo],
          consultor_id: user.id,
          empresa_id: empresaId,
          tipo: con.tipo || 'planejamento',
          descricao: con.descricao,
          valor: con.valor || 0,
          repasse_percentual: con.repasse_percentual || 100,
          prazo_meses: con.prazo_meses || 12,
          data_inicio: con.data_inicio || new Date().toISOString().split('T')[0],
          status: con.status || 'ativo'
        }])
        .select()
        .single();

      if (error) console.error("Erro contrato:", error);
      else if (con.id_antigo) contractMap[con.id_antigo] = newCon.id;
    }

    // 4. IMPORTAR PARCELAS
    const parcelasPayload = data.financeiro_parcelas
      .filter(p => contractMap[p.contrato_id_antigo] && clientMap[p.cliente_id_antigo])
      .map(p => ({
        contrato_id: contractMap[p.contrato_id_antigo],
        cliente_id: clientMap[p.cliente_id_antigo],
        valor_previsto: p.valor_previsto,
        valor_pago: p.valor_pago || 0,
        data_vencimento: p.data_vencimento,
        data_pagamento: p.data_pagamento,
        status: p.status || 'pendente'
      }));

    if (parcelasPayload.length > 0) {
      await supabase.from('financeiro_parcelas').insert(parcelasPayload);
    }

    return {
      clientes: Object.keys(clientMap).length,
      reunioes: reunioesPayload.length,
      contratos: Object.keys(contractMap).length,
      parcelas: parcelasPayload.length
    };
  }
};
