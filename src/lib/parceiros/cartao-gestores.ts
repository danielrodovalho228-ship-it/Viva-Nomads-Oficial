/*
  E822 — o destino do cartão "Gestores e administradoras" em /parceiros. Com a página de preços suspensa (chave
  PRECOS_VISIVEL desligada), comPortasDePrecos tirava o único link (/precos#plano-gestor) e o cartão ficava SEM destino —
  o único da página. Agora cai no Plano Gestor de /para-proprietarios (o mesmo texto único, GESTOR_TEXTO). Nunca vazio.
*/
import { comPortasDePrecos } from "../../config/precos-visivel.ts";

export function linksDoGestor(visivel?: boolean): { href: string; rotulo: string }[] {
  const comPrecos = comPortasDePrecos([{ href: "/precos#plano-gestor", rotulo: "Ver o Plano Gestor" }], visivel);
  return comPrecos.length > 0 ? comPrecos : [{ href: "/para-proprietarios#plano-gestor", rotulo: "Ver o Plano Gestor" }];
}
