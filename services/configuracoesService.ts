
import { supabase } from './supabaseClient';
import { financeiroService } from './financeiroService';

const getTargetId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return user.user_metadata?.empresa_id || user.id;
};

export const configService = {
  // --- MEU PERFIL ---
  async updateProfile(userId: string, updates: any) {
    const { data, error } = await supabase.auth.updateUser({ data: updates });
    if (error) throw error;
    await supabase.from('perfis').update(updates).eq('id', userId);
    return data;
  },

  async uploadAvatar(userId: string, file: File) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `perfis/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('vibe-assets').upload(filePath, file);
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from('vibe-assets').getPublicUrl(filePath);
    await this.updateProfile(userId, { avatar_url: publicUrl });
    return publicUrl;
  },

  // --- CONTRATOS PLANEJAMENTO ---
  async getPlanejamento() {
    const targetId = await getTargetId();
    const { data, error } = await supabase.from('padroes_contrato_planejamento').select('*').eq('empresa_id', targetId).order('nome');
    if (error) throw error;
    return data;
  },

  async savePlanejamento(item: any) {
    const targetId = await getTargetId();
    const { id, ...payload } = item;
    const finalPayload = { ...payload, empresa_id: targetId };
    const { data, error } = id
      ? await supabase.from('padroes_contrato_planejamento').update(finalPayload).eq('id', id).select().single()
      : await supabase.from('padroes_contrato_planejamento').insert([finalPayload]).select().single();

    if (error) throw error;

    if (id) {
      await financeiroService.sincronizarContratosPorPadrao(id, data);
    }

    return data;
  },

  async deletePlanejamento(id: string) {
    const { error } = await supabase.from('padroes_contrato_planejamento').delete().eq('id', id);
    if (error) throw error;
  },

  // --- CONTRATOS EXTRAS ---
  async getExtras() {
    const targetId = await getTargetId();
    const { data: headers, error: hError } = await supabase
      .from('padroes_contrato_extra')
      .select('*')
      .eq('empresa_id', targetId)
      .order('nome');

    if (hError) throw hError;

    return await Promise.all((headers || []).map(async (h) => {
      const { data: phases } = await supabase
        .from('padroes_contrato_extra_fases')
        .select('*')
        .eq('padrao_contrato_extra_id', h.id)
        .order('ordem');
      return { ...h, fases: phases || [] };
    }));
  },

  async saveExtra(item: any, fluxos: any[]) {
    const targetId = await getTargetId();
    const { id, fases: _, ...cleanItem } = item;
    const payload = { ...cleanItem, empresa_id: targetId };

    const { data: headerData, error: headerError } = id
      ? await supabase.from('padroes_contrato_extra').update(payload).eq('id', id).select().single()
      : await supabase.from('padroes_contrato_extra').insert([payload]).select().single();

    if (headerError) throw headerError;

    // Remove fluxos antigos se for edição
    if (id) {
      await supabase.from('padroes_contrato_extra_fases').delete().eq('padrao_contrato_extra_id', id);
    }

    // Salva novos fluxos se o tipo for pré-determinado
    if (item.repasse_tipo === 'pre' && fluxos && fluxos.length > 0) {
      const fluxosPayload = fluxos.map((f, index) => ({
        padrao_contrato_extra_id: headerData.id,
        percentual_repasse: f.percentual_repasse,
        mes_fim: f.sem_prazo ? null : f.mes_fim,
        ordem: index
      }));
      await supabase.from('padroes_contrato_extra_fases').insert(fluxosPayload);
    }

    return headerData;
  },

  async deleteExtra(id: string) {
    // Primeiro limpamos as fases vinculadas explicitamente
    await supabase.from('padroes_contrato_extra_fases').delete().eq('padrao_contrato_extra_id', id);
    // Depois removemos o padrão. As restrições ON DELETE SET NULL no banco garantem que contratos de clientes não impeçam a exclusão.
    const { error } = await supabase.from('padroes_contrato_extra').delete().eq('id', id);
    if (error) throw error;
  },

  // --- ACOMPANHAMENTO ---
  async getAcompanhamentos() {
    const targetId = await getTargetId();
    const { data: headers, error: hError } = await supabase.from('padroes_acompanhamento').select('*').eq('empresa_id', targetId);
    if (hError) throw hError;
    return await Promise.all((headers || []).map(async (h) => {
      const [fases, itens] = await Promise.all([
        supabase.from('padroes_acompanhamento_fases').select('*').eq('padrao_acompanhamento_id', h.id),
        supabase.from('padroes_acompanhamento_itens').select('*').eq('padrao_acompanhamento_id', h.id)
      ]);
      return { ...h, fases: fases.data || [], itens: itens.data || [] };
    }));
  },

  async saveAcompanhamento(header: any, fases: any[], itens: any[]) {
    const targetId = await getTargetId();
    const headerPayload: any = { ...header, empresa_id: targetId };
    if (!headerPayload.id) delete headerPayload.id;

    const { data: hData, error: hError } = header.id
      ? await supabase.from('padroes_acompanhamento').update(headerPayload).eq('id', header.id).select().single()
      : await supabase.from('padroes_acompanhamento').insert([headerPayload]).select().single();

    if (hError) throw hError;

    if (header.id) {
      await supabase.from('padroes_acompanhamento_itens').delete().eq('padrao_acompanhamento_id', hData.id);
      await supabase.from('padroes_acompanhamento_fases').delete().eq('padrao_acompanhamento_id', hData.id);
    }

    const phaseMapping: Record<string, string> = {};
    for (const phase of fases) {
      const { data: savedPhase } = await supabase.from('padroes_acompanhamento_fases').insert([{
        padrao_acompanhamento_id: hData.id,
        nome_fase: phase.nome_fase,
        ordem: phase.ordem
      }]).select().single();
      if (savedPhase && (phase.tempId || phase.id)) phaseMapping[phase.tempId || phase.id] = savedPhase.id;
    }

    const itemsPayload = itens.map(it => ({
      padrao_acompanhamento_id: hData.id,
      fase_id: it.fase_temp_id ? phaseMapping[it.fase_temp_id] : (it.fase_id ? (phaseMapping[it.fase_id] || it.fase_id) : null),
      descricao: it.descricao,
      ordem: it.ordem
    }));

    if (itemsPayload.length > 0) await supabase.from('padroes_acompanhamento_itens').insert(itemsPayload);
    return hData;
  },

  async deleteAcompanhamento(id: string) {
    const { error } = await supabase.from('padroes_acompanhamento').delete().eq('id', id);
    if (error) throw error;
  },

  // --- INVESTIMENTOS ---
  async getAssetAllocations() {
    const targetId = await getTargetId();
    const { data: headers, error } = await supabase.from('asset_allocations').select('*').eq('empresa_id', targetId).order('nome');
    if (error) throw error;
    return await Promise.all((headers || []).map(async h => {
      const { data: classes } = await supabase.from('asset_allocation_classes').select('*').eq('asset_allocation_id', h.id).order('ordem');
      return { ...h, classes: classes || [] };
    }));
  },

  async saveAssetAllocation(item: any, classes: any[]) {
    const targetId = await getTargetId();
    const { id, ...cleanItem } = item;
    const payload = { ...cleanItem, empresa_id: targetId };

    const { data: hData, error: hError } = id
      ? await supabase.from('asset_allocations').update(payload).eq('id', id).select().single()
      : await supabase.from('asset_allocations').insert([payload]).select().single();

    if (hError) throw hError;

    await supabase.from('asset_allocation_classes').delete().eq('asset_allocation_id', hData.id);

    // Se for novo registro sem classes definidas, insere 5 classes padrão
    const classesToSave = (classes && classes.length > 0) ? classes : (!id ? [
      { nome: 'Renda Fixa', percentual: 40, cor_rgb: '#10b981', ordem: 0 },
      { nome: 'Renda Variável', percentual: 25, cor_rgb: '#6366f1', ordem: 1 },
      { nome: 'Fundos Imobiliários', percentual: 15, cor_rgb: '#f59e0b', ordem: 2 },
      { nome: 'Multimercado', percentual: 10, cor_rgb: '#8b5cf6', ordem: 3 },
      { nome: 'Internacional', percentual: 10, cor_rgb: '#0ea5e9', ordem: 4 },
    ] : []);

    if (classesToSave.length > 0) {
      const cleanedClasses = classesToSave.map((c: any, index: number) => ({
        nome: c.nome,
        percentual: parseFloat(c.percentual.toString()),
        cor_rgb: c.cor_rgb || '#10b981',
        asset_allocation_id: hData.id,
        ordem: c.ordem ?? index
      }));

      const { error: cError } = await supabase.from('asset_allocation_classes').insert(cleanedClasses);
      if (cError) throw cError;
    }
    return hData;
  },

  async deleteAssetAllocation(id: string) {
    const { error } = await supabase.from('asset_allocations').delete().eq('id', id);
    if (error) throw error;
  },

  async getEstrategias() {
    const targetId = await getTargetId();
    const { data: headers, error } = await supabase.from('estrategias_base').select('*').eq('empresa_id', targetId).order('nome');
    if (error) throw error;
    return await Promise.all((headers || []).map(async h => {
      const { data: faixas } = await supabase.from('estrategias_faixas').select('*').eq('estrategia_id', h.id).order('intervalo_minimo');
      return { ...h, faixas: faixas || [] };
    }));
  },

  async saveEstrategia(estrategia: any, faixas: any[]) {
    const targetId = await getTargetId();
    const { id, ...cleanHeader } = estrategia;
    const payload = { ...cleanHeader, empresa_id: targetId };

    const { data: hData, error: hError } = id
      ? await supabase.from('estrategias_base').update(payload).eq('id', id).select().single()
      : await supabase.from('estrategias_base').insert([payload]).select().single();

    if (hError) throw hError;

    await supabase.from('estrategias_faixas').delete().eq('estrategia_id', hData.id);

    if (faixas && faixas.length > 0) {
      const cleanedFaixas = faixas.map(f => ({
        nome: f.nome || f.nome_faixa,
        intervalo_minimo: parseFloat(f.intervalo_minimo?.toString() || '0'),
        intervalo_maximo: f.ilimitado ? null : parseFloat(f.intervalo_maximo?.toString() || '0'),
        estrategia_id: hData.id
      }));

      const { error: fError } = await supabase.from('estrategias_faixas').insert(cleanedFaixas);
      if (fError) throw fError;
    }
    return hData;
  },

  async deleteEstrategia(id: string) {
    const { error } = await supabase.from('estrategias_base').delete().eq('id', id);
    if (error) throw error;
  },

  async getBancos() {
    const targetId = await getTargetId();
    const { data, error } = await supabase.from('bancos_corretoras').select('*').eq('empresa_id', targetId).order('nome');
    if (error) throw error;
    return data;
  },

  async saveBanco(banco: any) {
    const targetId = await getTargetId();
    const { id, ...cleanBanco } = banco;
    const payload = { ...cleanBanco, empresa_id: targetId };

    const { data, error } = id
      ? await supabase.from('bancos_corretoras').update(payload).eq('id', id).select()
      : await supabase.from('bancos_corretoras').insert([payload]).select();
    if (error) throw error;
    return data;
  },

  async deleteBanco(id: string) {
    const { error } = await supabase.from('bancos_corretoras').delete().eq('id', id);
    if (error) throw error;
  }
};
