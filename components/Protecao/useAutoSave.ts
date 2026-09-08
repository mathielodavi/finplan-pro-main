
import { useCallback, useEffect, useRef, useState } from 'react';

interface AutoSaveOptions<T> {
    /** Função que efetivamente persiste `dados` (ex.: `d => protecaoService.update(clienteId, d)`).
     * Deve ser estável entre renders (useCallback) — trocar a identidade não quebra nada, mas
     * recria a cadeia de retry em andamento. */
    saveFn: (dados: T) => Promise<any>;
    debounceMs?: number;
}

const MAX_TENTATIVAS = 3;

export function useAutoSave<T>({ saveFn, debounceMs = 1200 }: AutoSaveOptions<T>) {
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<Date | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    /** Último payload que ainda não foi confirmado como salvo — usado pelo retry automático e
     * pelo flush ao desmontar. Só é limpo quando um save realmente tem sucesso. */
    const pendingRef = useRef<T | null>(null);
    const tentativaRef = useRef(0);
    const saveFnRef = useRef(saveFn);
    saveFnRef.current = saveFn;

    // Tenta salvar `dados`; em falha, reagenda automaticamente (backoff simples) até
    // MAX_TENTATIVAS — antes disso, uma falha era descartada silenciosamente: o campo continuava
    // mostrando o valor digitado (estado local), mas o banco nunca recebia a escrita.
    const executar = useCallback(async (dados: T, tentativaAtual: number) => {
        setSaving(true);
        try {
            await saveFnRef.current(dados);
            setSavedAt(new Date());
            setSaveError(null);
            pendingRef.current = null;
            tentativaRef.current = 0;
        } catch (err: any) {
            pendingRef.current = dados;
            console.error('[autoSave]', err);
            if (tentativaAtual < MAX_TENTATIVAS) {
                setSaveError('Erro ao salvar — tentando novamente...');
                tentativaRef.current = tentativaAtual + 1;
                if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
                retryTimerRef.current = setTimeout(() => executar(dados, tentativaAtual + 1), 3000 * (tentativaAtual + 1));
            } else {
                setSaveError('Não foi possível salvar. Verifique sua conexão e tente novamente.');
            }
        } finally {
            setSaving(false);
        }
    }, []);

    const save = useCallback(
        (dados: T) => {
            pendingRef.current = dados;
            if (timerRef.current) clearTimeout(timerRef.current);
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            tentativaRef.current = 0;
            timerRef.current = setTimeout(() => executar(dados, 0), debounceMs);
        },
        [executar, debounceMs],
    );

    const saveImmediate = useCallback(async (dados: T) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        pendingRef.current = dados;
        tentativaRef.current = 0;
        setSaveError(null);
        setSaving(true);
        try {
            await saveFnRef.current(dados);
            setSavedAt(new Date());
            setSaveError(null);
            pendingRef.current = null;
        } catch (err: any) {
            setSaveError('Erro ao salvar.');
            throw err;
        } finally {
            setSaving(false);
        }
    }, []);

    // Flush ao desmontar: se o consultor navegar para outro cliente (ou fechar a aba) dentro da
    // janela do debounce, a alteração pendente não pode simplesmente desaparecer — sem isto, o
    // timer nunca disparava (o componente já não existe mais) e a última edição se perdia sem
    // nenhum aviso, exatamente o sintoma relatado (campo ficava só no state local da seção).
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            if (pendingRef.current !== null) {
                saveFnRef.current(pendingRef.current).catch(err => console.error('[autoSave] flush ao desmontar falhou', err));
            }
        };
    }, []);

    const savedAtLabel = savedAt
        ? `Salvo às ${savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
        : null;

    return { save, saveImmediate, saving, savedAt, savedAtLabel, saveError };
}
