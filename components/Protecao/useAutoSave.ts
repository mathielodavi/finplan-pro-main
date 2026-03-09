
import { useCallback, useRef, useState } from 'react';
import { protecaoService } from '../../services/protecaoService';

interface AutoSaveOptions {
    clienteId: string;
    debounceMs?: number;
}

export function useAutoSave({ clienteId, debounceMs = 1200 }: AutoSaveOptions) {
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<Date | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const save = useCallback(
        (dados: Record<string, any>) => {
            if (timerRef.current) clearTimeout(timerRef.current);

            timerRef.current = setTimeout(async () => {
                setSaving(true);
                setSaveError(null);
                try {
                    await protecaoService.update(clienteId, dados);
                    setSavedAt(new Date());
                } catch (err: any) {
                    setSaveError('Erro ao salvar. Tente novamente.');
                    console.error('[autoSave]', err);
                } finally {
                    setSaving(false);
                }
            }, debounceMs);
        },
        [clienteId, debounceMs],
    );

    const saveImmediate = useCallback(async (dados: Record<string, any>) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setSaving(true);
        setSaveError(null);
        try {
            await protecaoService.update(clienteId, dados);
            setSavedAt(new Date());
        } catch (err: any) {
            setSaveError('Erro ao salvar.');
            throw err;
        } finally {
            setSaving(false);
        }
    }, [clienteId]);

    const savedAtLabel = savedAt
        ? `Salvo às ${savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
        : null;

    return { save, saveImmediate, saving, savedAt, savedAtLabel, saveError };
}
