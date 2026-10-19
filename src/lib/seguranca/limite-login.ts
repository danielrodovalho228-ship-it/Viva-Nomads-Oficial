/*
  Atraso progressivo do login NO SERVIDOR (ordem dddccd2f). Regra pura e testável:
  cada tentativa de entrar consome 3 degraus por e-mail (1 min, 10 min, 1 h) e 1 por IP.
  Passou de um degrau → recusa até o fim da janela dele, sem dizer se a conta existe.
  Infra do limitador fora do ar NÃO tranca ninguém (falha aberta; o Supabase ainda tem o dele).
*/

export type SituacaoLimite = "ok" | "estourou" | "erro";
export type Limitar = (chave: string, maximo: number, janelaSegundos: number) => Promise<SituacaoLimite>;

export const DEGRAUS_EMAIL = [
  { id: "1m", maximo: 5, janela: 60 },
  { id: "10m", maximo: 10, janela: 600 },
  { id: "1h", maximo: 20, janela: 3600 },
] as const;
export const MAX_POR_IP = 40;
export const JANELA_IP = 900;

export interface ResultadoLogin {
  permitido: boolean;
  /** Pior espera (s) entre os degraus estourados; 0 se permitido. */
  esperaSegundos: number;
}

export async function avaliarTentativaLogin(emailHash: string, ipHashValor: string, limitar: Limitar): Promise<ResultadoLogin> {
  let espera = 0;
  for (const d of DEGRAUS_EMAIL) {
    if ((await limitar(`login:email:${d.id}:${emailHash}`, d.maximo, d.janela)) === "estourou") {
      espera = Math.max(espera, d.janela);
    }
  }
  if ((await limitar(`login:ip:${ipHashValor}`, MAX_POR_IP, JANELA_IP)) === "estourou") {
    espera = Math.max(espera, JANELA_IP);
  }
  return { permitido: espera === 0, esperaSegundos: espera };
}

export const MSG_LOGIN_ESPERAR = "Muitas tentativas. Aguarde um pouco para tentar de novo.";
