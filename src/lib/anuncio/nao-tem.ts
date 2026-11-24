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
  // E753: "Wi-Fi" saiu desta lista. A internet NÃO é comodidade marcada (E39): vem da categoria de uso informada pelo proprietário
  // (`internetTier`) ou da medição, e o padrão mínimo Viva a promete em todos os imóveis. Listá-la em "Não tem" negava o que o próprio
  // anúncio afirma ("Espaço de trabalho: Internet para trabalho remoto…").
  { rotulo: "Vaga de garagem", padrao: /vaga|garagem|estacionamento/ },
];

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const PADRAO_VAGA = ESPERADAS.find((e) => e.rotulo === "Vaga de garagem")!.padrao;
const textosDasComodidades = (property: Property) =>
  agruparComodidades(property).grupos.flatMap((g) => g.items).flatMap((i) => [i.toLowerCase(), semAcento(i)]);

/**
 * E1052: o FACTO único "o imóvel tem vaga de garagem" — o campo de vagas (> 0, o mesmo da linha-síntese "N vagas") ou a
 * comodidade de vaga marcada. A página não pode afirmar a vaga num sítio e negá-la no "Não tem".
 */
export function temVagaDeGaragem(property: Property): boolean {
  return (property.parkingSpots ?? 0) > 0 || textosDasComodidades(property).some((t) => PADRAO_VAGA.test(t));
}

/**
 * Itens esperados que NÃO estão marcados no cadastro. Sem nenhuma comodidade cadastrada devolve []:
 * sem dado, a Viva não afirma que o imóvel "não tem" nada.
 */
export function comodidadesQueNaoTem(property: Property): string[] {
  const { grupos, total } = agruparComodidades(property);
  if (total === 0) return [];
  const textos = grupos.flatMap((g) => g.items).flatMap((i) => [i.toLowerCase(), semAcento(i)]);
  // E1052: a vaga sai do "Não tem" quando o facto único diz que há vaga (campo de vagas ou comodidade).
  const temVaga = temVagaDeGaragem(property);
  // E111-A: o que o tipo do imóvel não comporta (ex.: elevador numa chácara) também não entra no "Não tem".
  const valeNoTipo = (rotulo: string) => {
    const chave = AMENITY_KEY_BY_LABEL[rotulo];
    return !chave || comodidadeValeParaTipo(chave, property.propertyType);
  };
  return ESPERADAS.filter(
    (e) => valeNoTipo(e.rotulo) && !(e.rotulo === "Vaga de garagem" && temVaga) && !textos.some((t) => e.padrao.test(t)),
  ).map((e) => e.rotulo);
}
