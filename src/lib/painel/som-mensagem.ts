/*
  E445 item 6 — som discreto de mensagem nova com o site aberto, desligável em /dashboard/notificacoes. PURO (decisão e
  preferência); o toque em si mora em src/components/painel/som-mensagem.tsx.
  Roda: node --test src/lib/painel/som-mensagem.test.ts

  - A casca do painel já relê os contadores (mensagensRecebidas) a cada minuto, ao voltar o foco e quando uma tela avisa.
  - Toca só quando o número de mensagens recebidas SOBE em relação à leitura anterior desta aba: a 1ª leitura (ao abrir o site)
    nunca toca — o som é de mensagem NOVA, não das que já estavam lá.
  - A preferência é deste aparelho (localStorage), lida a cada leitura: ligado por padrão; "0" = desligado.
*/
export const CHAVE_SOM_MENSAGEM = "vivanomads-som-mensagem";

export function deveTocarSom(anterior: number | null, atual: number, ligado: boolean): boolean {
  return ligado && anterior !== null && atual > anterior;
}

/** Valor guardado → ligado? Ausente ou ilegível = ligado (padrão). */
export function somLigadoDe(valor: string | null | undefined): boolean {
  return valor !== "0";
}

export function valorDoSom(ligado: boolean): string {
  return ligado ? "1" : "0";
}
