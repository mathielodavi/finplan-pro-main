
/**
 * Funções puras de cálculo financeiro para o Módulo de Proteção.
 * Baseadas na metodologia HP-12C (Valor Presente de anuidade).
 */

// ─── Valor Presente (VP / PV) ─────────────────────────────────────────────────

/**
 * Calcula o Valor Presente de uma série de pagamentos periódicos.
 * Equivalent to PV function.
 *
 * @param taxaMensal  Taxa de juros mensal (decimal). Ex: 0.0012 para 0,12%/mês
 * @param nPeriodos   Número total de períodos mensais
 * @param pagamento   Valor do pagamento periódico (PMT)
 * @returns Valor Presente
 */
export function calcularVP(taxaMensal: number, nPeriodos: number, pagamento: number): number {
    if (pagamento <= 0 || nPeriodos <= 0) return 0;
    if (taxaMensal === 0) return pagamento * nPeriodos;

    const vp = pagamento * (1 - Math.pow(1 + taxaMensal, -nPeriodos)) / taxaMensal;
    return Math.round(vp * 100) / 100;
}

/**
 * Converte taxa anual para taxa mensal equivalente.
 * Ex: 6.25% a.a. → taxa mensal
 */
export function taxaAnualParaMensal(taxaAnualPercentual: number): number {
    return Math.pow(1 + taxaAnualPercentual / 100, 1 / 12) - 1;
}

/**
 * Calcula a taxa real mensal descontando inflação.
 * Formula: ((1 + juros_aa%) / (1 + ipca_aa%)) - 1 → mensal
 */
export function calcularTaxaRealMensal(taxaJurosAa: number, ipcaAa: number): number {
    const taxaReal = (1 + taxaJurosAa / 100) / (1 + ipcaAa / 100) - 1;
    return taxaAnualParaMensal(taxaReal * 100);
}

// ─── IMC ─────────────────────────────────────────────────────────────────────

/**
 * Calcula o Índice de Massa Corporal.
 * @param pesoKg   Peso em quilogramas
 * @param alturaCm Altura em centímetros
 */
export function calcularIMC(pesoKg: number, alturaCm: number): number {
    if (!pesoKg || !alturaCm || alturaCm <= 0) return 0;
    const alturaM = alturaCm / 100;
    return Math.round((pesoKg / (alturaM * alturaM)) * 10) / 10;
}

export function classificarIMC(imc: number): string {
    if (imc < 18.5) return 'Abaixo do peso';
    if (imc < 25) return 'Peso normal';
    if (imc < 30) return 'Sobrepeso';
    if (imc < 35) return 'Obesidade grau I';
    if (imc < 40) return 'Obesidade grau II';
    return 'Obesidade grau III';
}

// ─── Idade ────────────────────────────────────────────────────────────────────

/**
 * Calcula a idade em anos completos a partir da data de nascimento.
 */
export function calcularIdade(dataNascimento: string | undefined): number | null {
    if (!dataNascimento) return null;
    const dataRef = new Date();
    const nascimento = new Date(dataNascimento + 'T00:00:00-03:00');
    if (isNaN(nascimento.getTime())) return null;

    let idade = dataRef.getFullYear() - nascimento.getFullYear();
    const mesAtual = dataRef.getMonth();
    const mesNasc = nascimento.getMonth();
    const diaAtual = dataRef.getDate();
    const diaNasc = nascimento.getDate();

    if (mesAtual < mesNasc || (mesAtual === mesNasc && diaAtual < diaNasc)) {
        idade--;
    }
    return idade < 0 ? 0 : idade;
}

// ─── Validação de CPF ─────────────────────────────────────────────────────────

/**
 * Valida CPF com dígitos verificadores.
 */
export function validarCPF(cpf: string): boolean {
    const numeros = cpf.replace(/\D/g, '');
    if (numeros.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(numeros)) return false; // CPFs inválidos tipo 111.111.111-11

    const calcDigito = (cpf: string, len: number): number => {
        let soma = 0;
        for (let i = 0; i < len; i++) {
            soma += parseInt(cpf[i]) * (len + 1 - i);
        }
        const resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    };

    const d1 = calcDigito(numeros, 9);
    const d2 = calcDigito(numeros, 10);

    return parseInt(numeros[9]) === d1 && parseInt(numeros[10]) === d2;
}

// ─── Máscaras ─────────────────────────────────────────────────────────────────

export function mascaraCPF(valor: string): string {
    const nums = valor.replace(/\D/g, '').slice(0, 11);
    return nums
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function mascaraTelefone(valor: string): string {
    const nums = valor.replace(/\D/g, '').slice(0, 11);
    if (nums.length <= 10) {
        return nums.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    }
    return nums.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

export function mascaraMoeda(valor: string): string {
    const nums = valor.replace(/\D/g, '');
    if (!nums) return '';
    const num = parseInt(nums) / 100;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseMoeda(valor: string): number {
    const nums = valor.replace(/\D/g, '');
    if (!nums) return 0;
    return parseInt(nums) / 100;
}

// ─── Cálculos de Cobertura ───────────────────────────────────────────────────

/**
 * Fórmula Excel VF para cobertura de um membro:
 * ARRED(-VF(taxa_real_anual; período; 0; -((renda_membro - despesas_membro) * período * 12)); 0)
 * = (renda_membro - despesas_membro) * período * 12 * (1 + taxa_aa)^período
 */
function calcularCoberturaVF(rendaMembro: number, despesasMembro: number, periodoAnos: number, taxaRealAnual: number): number {
    const gap = rendaMembro - despesasMembro;
    if (gap <= 0) return 0;
    const base = gap * periodoAnos * 12;
    return Math.round(base * Math.pow(1 + taxaRealAnual / 100, periodoAnos));
}

export interface ResultadoCobertura {
    coberturaCliente: number;
    coberturaConjuge: number;
    coberturaFamiliar: number;
    totalDespesas: number;
    rendaTotal: number;
}

/**
 * Fórmula de cobertura de vida (base anual):
 * ARRED(-VF(taxa_real_anual; período; 0; -(gap * período * 12)); 0)
 * gap = max(0, totalDespesas - renda_sobrevivente)
 *
 * Quando o membro falece, o sobrevivente continua contribuindo com sua renda.
 * A cobertura é o gap entre as despesas e a renda remanescente.
 */
export function calcularCoberturaVida(
    rendaCliente: number,
    rendaConjuge: number,
    totalDespesas: number,
    periodoCoberturaAnos: number,
    taxaRealAnual: number,
): ResultadoCobertura {
    const rendaTotal = rendaCliente + rendaConjuge;

    // Se o CLIENTE falecer: sobrevivente = cônjuge com renda_conjuge
    const gapCliente = Math.max(0, totalDespesas - rendaConjuge);
    const baseCliente = gapCliente * periodoCoberturaAnos * 12;
    const coberturaCliente = Math.round(baseCliente * Math.pow(1 + taxaRealAnual / 100, periodoCoberturaAnos));

    // Se o CÔNJUGE falecer: sobrevivente = cliente com renda_cliente
    const gapConjuge = Math.max(0, totalDespesas - rendaCliente);
    const baseConjuge = gapConjuge * periodoCoberturaAnos * 12;
    const coberturaConjuge = Math.round(baseConjuge * Math.pow(1 + taxaRealAnual / 100, periodoCoberturaAnos));

    const coberturaFamiliar = coberturaCliente + coberturaConjuge;

    return {
        coberturaCliente,
        coberturaConjuge,
        coberturaFamiliar,
        totalDespesas,
        rendaTotal,
    };
}


export interface ResultadoSucessao {
    totalFuneral: number;
    custoInventario: number;
    ativosPrevidenciarios: number;
    totalNecessidades: number;
    coberturaSucessao: number;
}

export function calcularSucessao(
    funeralCliente: number,
    funeralConjuge: number,
    bensCliente: number,
    bensConjuge: number,
    investimentosCliente: number,
    investimentosConjuge: number,
    dividasCliente: number,
    dividasConjuge: number,
    pgblCliente: number,
    pgblConjuge: number,
    vgblCliente: number,
    vgblConjuge: number,
    percCustosInventario: number,
    honorariosPerc?: number,
    itcmdPerc?: number,
): ResultadoSucessao {
    const totalFuneral = funeralCliente + funeralConjuge;
    const totalBens = bensCliente + bensConjuge;
    const totalInvestimentos = investimentosCliente + investimentosConjuge;
    const totalDividas = dividasCliente + dividasConjuge;
    const percEfetivo = (honorariosPerc !== undefined && itcmdPerc !== undefined)
        ? honorariosPerc + itcmdPerc
        : percCustosInventario;
    // Base do inventário = bens + investimentos + dívidas
    const baseInventario = totalBens + totalInvestimentos + totalDividas;
    const custoInventario = baseInventario * (percEfetivo / 100);
    // Apenas ativos previdenciarios (passam diretamente aos herdeiros, sem inventario)
    const ativosPrevidenciarios = pgblCliente + pgblConjuge + vgblCliente + vgblConjuge;
    const totalNecessidades = totalFuneral + custoInventario;
    const coberturaSucessao = Math.max(0, totalNecessidades - ativosPrevidenciarios);

    return {
        totalFuneral,
        custoInventario,
        ativosPrevidenciarios,
        totalNecessidades,
        coberturaSucessao: Math.round(coberturaSucessao),
    };
}
