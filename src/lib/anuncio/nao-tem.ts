import type { Property } from "../types.ts";
import { agruparComodidades } from "./comodidades.ts";
import { AMENITY_KEY_BY_LABEL, comodidadeValeParaTipo } from "../amenities.ts";

/**
 * Itens que o morador costuma esperar. Lista curta e FIXA em código (ordem da tela "Tem / Não tem").
 * `padrao` casa com o texto da comodidade cadastrada (sem acento, minúsculo).
 */
export const ESPERADAS: readonly { rotulo: string; padrao: RegExp }[] = [
  { rotulo: "Lava-louças", padrao: /lava[- ]?lou[cç]as/ },
  { rotulo: "TV", padrao: /\btv\b|televis/ },
  { rotulo: "Elevador", padrao: /elevador/ },
  { rotulo: "Máquina de lavar", padrao: /m[aá]quina de lavar|lavadora/ },
  { rotulo: "Ar-condicionado", padrao: /ar[- ]?condicionado|climatiza/ },
  { rotulo: "Wi-Fi", padrao: /wi-?fi|internet|fibra/ },
  { rotulo: "Vaga de garagem", padrao: /vaga|garagem|estacionamento/ },
];

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Itens esperados que NÃO estão marcados no cadastro. Sem nenhuma comodidade cadastrada devolve []:
 * sem dado, a Viva não afirma que o imóvel "não tem" nada.
 */
export function comodidadesQueNaoTem(property: Property): string[] {
  const { grupos, total } = agruparComodidades(property);
  if (total === 0) return [];
  const textos = grupos.flatMap((g) => g.items).flatMap((i) => [i.toLowerCase(), semAcento(i)]);
  // E111-A: o que o tipo do imóvel não comporta (ex.: elevador numa chácara) também não entra no "Não tem".
  const valeNoTipo = (rotulo: string) => {
    const chave = AMENITY_KEY_BY_LABEL[rotulo];
    return !chave || comodidadeValeParaTipo(chave, property.propertyType);
  };
  return ESPERADAS.filter((e) => valeNoTipo(e.rotulo) && !textos.some((t) => e.padrao.test(t))).map((e) => e.rotulo);
}
