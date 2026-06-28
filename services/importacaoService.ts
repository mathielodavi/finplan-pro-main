import { investimentoService } from './investimentoService';
import * as xlsx from 'xlsx';

export const importacaoService = {
    async processarArquivoCustodia(clienteId: string, file: File): Promise<void> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = xlsx.read(data, { type: 'array' });
                    const firstSheet = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheet];
                    const jsonData = xlsx.utils.sheet_to_json(worksheet);

                    // Aqui você pode mapear `jsonData` para o formato esperado pelo seu sistema
                    // Exemplo básico (ajuste conforme as colunas reais da sua planilha):
                    /*
                    for (const row of jsonData as any[]) {
                      await investimentoService.salvarAtivo({
                        cliente_id: clienteId,
                        nome: row.Ativo || row.Nome || row.Produto,
                        valor_atual: Number(row.Valor || row.Saldo) || 0,
                        // outras propriedades...
                      });
                    }
                    */

                    console.log('Arquivo importado:', jsonData);
                    resolve();
                } catch (error) {
                    console.error('Erro ao processar arquivo:', error);
                    reject(error);
                }
            };

            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    }
};
