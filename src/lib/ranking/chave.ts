/*
  Chave da ordem nova (Prompt 33, item 5) — PURO. Quem lê o banco e o ambiente é src/lib/data/ranking.ts.
  - ORDEM_NOVA_ATIVA (ambiente, só servidor): "on" liga; qualquer outro valor ou ausente = desligada.
  - Interruptor do admin (tabela plataforma_chaves): quando existe, PREVALECE sobre o ambiente — desligar no
    admin volta para a ordem antiga na hora, sem deploy.
*/
import { FUSO_BRASILIA } from "../datas-brasilia.ts";

export const CHAVE_ORDEM_NOVA = "ordem_nova_ativa";

export function ordemNovaLigada(ambiente: string | undefined, interruptor: boolean | null): boolean {
  return interruptor ?? ambiente === "on";
}

/** Semente do rodízio da home: AAAAMMDD no dia de São Paulo (a vitrine muda à meia-noite de Brasília). */
export function sementeDoDia(agora: Date): number {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_BRASILIA, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
  return Number(p.replaceAll("-", ""));
}

/** Modo sombra: grava 1 em cada 5 buscas. `sorteio` vem de Math.random() no servidor (injetável nos testes). */
export const AMOSTRA_SOMBRA = 5;
export function gravarSombra(sorteio: number): boolean {
  return Math.floor(sorteio * AMOSTRA_SOMBRA) === 0;
}

/** Registros da sombra vivem 30 dias. */
export const DIAS_SOMBRA = 30;
