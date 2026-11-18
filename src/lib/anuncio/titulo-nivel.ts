/*
  E814 — o TÍTULO não usa o nome de um nível diferente do nível CALCULADO do anúncio. "Studio premium" num anúncio
  Essencial contava duas histórias opostas. O nível é da Viva (calculado pelos itens confirmados e provados), não do texto:
  "premium" só com nível Premium; "conforto" (a palavra inteira; "confortável" não conta) só com nível Conforto.
  Sem nível calculado (anúncio novo, em adequação), nenhum termo de nível no título. PURO.
*/
import { ROTULO_NIVEL, type Nivel, type NivelOuAdequacao } from "../../config/niveis.ts";

const TERMOS: readonly { nivel: Nivel; termo: string; re: RegExp }[] = [
  { nivel: "premium", termo: "premium", re: /(^|[^\p{L}])premium($|[^\p{L}])/iu },
  { nivel: "conforto", termo: "conforto", re: /(^|[^\p{L}])conforto($|[^\p{L}])/iu },
];

/** O termo de nível que o título usa e que NÃO é o nível calculado; null se o título não usa nenhum ou usa o certo. */
export function termoDeNivelDivergente(titulo: string, nivel: NivelOuAdequacao | null | undefined): { termo: string; nivelDoTermo: Nivel } | null {
  const t = titulo ?? "";
  for (const x of TERMOS) if (x.re.test(t) && x.nivel !== nivel) return { termo: x.termo, nivelDoTermo: x.nivel };
  return null;
}

/** A frase do aviso (editor e assistente) e do erro do servidor. */
export function erroTituloNivel(titulo: string, nivel: NivelOuAdequacao | null | undefined): string | null {
  const d = termoDeNivelDivergente(titulo, nivel);
  if (!d) return null;
  const atual = nivel && nivel !== "em_adequacao" ? `o nível do anúncio é ${ROTULO_NIVEL[nivel]}` : "o anúncio ainda não tem nível calculado";
  return `O título diz "${d.termo}", mas ${atual}. O nível é calculado pela Viva: tire "${d.termo}" do título.`;
}
