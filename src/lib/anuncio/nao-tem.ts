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
  // E812: o que a detecção viu nas fotos (e o dono ainda não marcou) NUNCA entra no "Não tem": a página não desmente a
  // própria foto. O dono recebe a sugestão no painel ("Encontramos isto numa foto sua") — esse é o alerta.
  const visto = new Set(property.vistoNasFotos ?? []);
  const vistoNaFoto = (rotulo: string) => {
    const chave = AMENITY_KEY_BY_LABEL[rotulo];
    return !!chave && visto.has(chave);
  };
  return ESPERADAS.filter((e) => valeNoTipo(e.rotulo) && !vistoNaFoto(e.rotulo) && !textos.some((t) => e.padrao.test(t))).map((e) => e.rotulo);
}
