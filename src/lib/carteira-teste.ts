/*
  Prompt 27, item 8 — plano PURO da carteira de teste (testável): 3 imóveis "[TESTE QA] Carteira N"; os dois primeiros
  com contrato simulado ENCERRADO (blocos no passado) e o terceiro com contrato ATIVO (bloco cobrindo hoje).
*/
export const PREFIXO_CARTEIRA_TESTE = "[TESTE QA] Carteira";

export interface ItemCarteiraTeste {
  titulo: string;
  valorMensal: number;
  meses: number;
  inicio: string;
  fim: string;
  statusContrato: "ativo" | "concluido";
  statusBloco: "ativo" | "encerrado";
}

const dia = (base: Date, n: number) => new Date(base.getTime() + n * 86_400_000).toISOString().slice(0, 10);

export function planoCarteiraTeste(hoje: Date): ItemCarteiraTeste[] {
  return [
    { titulo: `${PREFIXO_CARTEIRA_TESTE} 1`, valorMensal: 2800, meses: 3, inicio: dia(hoje, -200), fim: dia(hoje, -111), statusContrato: "concluido", statusBloco: "encerrado" },
    { titulo: `${PREFIXO_CARTEIRA_TESTE} 2`, valorMensal: 3200, meses: 4, inicio: dia(hoje, -150), fim: dia(hoje, -31), statusContrato: "concluido", statusBloco: "encerrado" },
    { titulo: `${PREFIXO_CARTEIRA_TESTE} 3`, valorMensal: 3600, meses: 4, inicio: dia(hoje, -20), fim: dia(hoje, 99), statusContrato: "ativo", statusBloco: "ativo" },
  ];
}
