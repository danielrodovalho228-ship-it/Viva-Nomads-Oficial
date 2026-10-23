/*
  Adendo 59.1, Parte A — textos e listas da EXIBIÇÃO do nível (PURO). Tudo sai de src/config/niveis.ts e das regras da
  Pista B (src/lib/niveis/regras.ts): mudou um critério ali, a ficha, o cadastro e o painel mudam junto.
  Nível é fato do anúncio, não selo: não muda a ordem da busca nem a taxa.
*/
import {
  AREAS,
  EXTRAS,
  MATRIZ,
  NIVEIS,
  ROTULO_AREA,
  ROTULO_NIVEL,
  ROTULO_RUIDO,
  itemNivel,
  type Area,
  type ChaveNivel,
  type ClasseRuido,
  type Nivel,
  type NivelOuAdequacao,
  type ProvaItem,
} from "../../config/niveis.ts";
import { fatosAtendidos, nivelDoImovel, type EntradaNivel } from "./regras.ts";

/** Critério resumido de cada nível, em uma frase (ficha do imóvel e "Como funcionam os níveis"). */
export const CRITERIO_NIVEL: Record<Nivel, string> = {
  essencial: "Os 12 itens do padrão mínimo da Viva, confirmados pelo proprietário.",
  conforto: "Padrão mínimo e mais conforto em cada área: roupa de cama extra, ar-condicionado no quarto principal, internet medida e ruído sob controle. Cada item com foto.",
  premium: "Tudo do Conforto e padrão hotel em cada área: ar-condicionado em todos os quartos e na sala, forno, lavadora e secadora e internet boa para videochamada. Cada item com foto.",
};

/** "Nível Conforto" / "Nível Conforto · vistoriado". Abaixo do Essencial não há nome público. */
export function tituloNivel(nivel: NivelOuAdequacao | null | undefined, vistoriado = false): string | null {
  if (!nivel || nivel === "em_adequacao") return null;
  return `Nível ${ROTULO_NIVEL[nivel]}${vistoriado ? " · vistoriado" : ""}`;
}

/** "Sala: Premium · Trabalho: Premium" — áreas acima do nível do imóvel. */
export function textoDiferenciais(diferenciais: readonly { area: Area; nivel: Nivel }[] | null | undefined): string | null {
  const validos = (diferenciais ?? []).filter((d) => (AREAS as readonly string[]).includes(d.area) && (NIVEIS as readonly string[]).includes(d.nivel));
  if (!validos.length) return null;
  return validos.map((d) => `${ROTULO_AREA[d.area]}: ${ROTULO_NIVEL[d.nivel]}`).join(" · ");
}

/** O ruído como fato: "Ruído baixo" / "Ruído alto, com janelas de isolamento acústico". */
export function textoRuido(classe: ClasseRuido | null | undefined, isolamento = false): string | null {
  if (!classe) return null;
  return `Ruído ${ROTULO_RUIDO[classe]}${isolamento ? ", com janelas de isolamento acústico" : ""}`;
}

/** Extras na ordem da lista, só os conhecidos: "Secador de cabelo, Air fryer". */
export function textoExtras(chaves: readonly string[] | null | undefined): string | null {
  const sel = new Set(chaves ?? []);
  const rotulos = EXTRAS.filter((e) => sel.has(e.chave)).map((e) => e.rotulo);
  return rotulos.length ? rotulos.join(", ") : null;
}

/** Próximo nível do imóvel (null no Premium). Em adequação, o próximo é o Essencial. */
export function proximoNivel(nivel: NivelOuAdequacao): Nivel | null {
  if (nivel === "em_adequacao") return "essencial";
  const i = NIVEIS.indexOf(nivel);
  return i < NIVEIS.length - 1 ? NIVEIS[i + 1] : null;
}

export interface ItemQueFalta {
  chave: ChaveNivel;
  rotulo: string;
  criterio: string;
  prova: ProvaItem;
}

/**
 * Cadastro (passo Comodidades): o nível que o imóvel atinge AGORA e, item a item, o que falta para o próximo, por área.
 * O Essencial é o padrão mínimo (o checklist logo acima), então ele não entra aqui.
 */
export function nivelAgoraEFalta(e: EntradaNivel): { nivel: NivelOuAdequacao; proximo: Nivel | null; falta: { area: Area; itens: ItemQueFalta[] }[] } {
  const { nivel } = nivelDoImovel(e);
  const proximo = proximoNivel(nivel);
  if (!proximo || proximo === "essencial") return { nivel, proximo, falta: [] };
  const fatos = fatosAtendidos(e);
  const vistos = new Set<string>();
  const falta = AREAS.map((area) => {
    const exigidos: ChaveNivel[] = [...MATRIZ[area].conforto, ...(proximo === "premium" ? MATRIZ[area].premium : [])];
    const itens = exigidos
      .filter((k) => !fatos.has(k) && !vistos.has(k) && (vistos.add(k), true))
      .map((k) => {
        const i = itemNivel(k);
        return { chave: k, rotulo: i.rotulo, criterio: i.criterio, prova: i.prova };
      });
    return { area, itens };
  }).filter((g) => g.itens.length > 0);
  return { nivel, proximo, falta };
}

/**
 * Painel do dono: o nível caiu por causa de pendência aberta ("não confere" na entrada)? Compara o nível com e sem as
 * pendências; devolve a queda e os itens que a causaram, ou null.
 */
export function quedaPorPendencia(e: EntradaNivel): { de: Nivel; para: Nivel; itens: string[] } | null {
  if (!e.bloqueadas.length) return null;
  const com = nivelDoImovel(e).nivel;
  const sem = nivelDoImovel({ ...e, bloqueadas: [] }).nivel;
  const ORDEM: Record<NivelOuAdequacao, number> = { em_adequacao: -1, essencial: 0, conforto: 1, premium: 2 };
  if (com === "em_adequacao" || sem === "em_adequacao" || ORDEM[com] >= ORDEM[sem]) return null;
  // Só as pendências que de fato seguram o nível: sem cada uma, o nível sobe.
  const itens = e.bloqueadas.filter((b) => ORDEM[nivelDoImovel({ ...e, bloqueadas: e.bloqueadas.filter((x) => x !== b) }).nivel] > ORDEM[com]);
  return { de: sem, para: com, itens: itens.length ? itens : [...e.bloqueadas] };
}

/** Texto da decisão do painel: "Studio Centro caiu de Conforto para Essencial: corrija Micro-ondas". */
export function textoQueda(imovel: string, q: { de: Nivel; para: Nivel }, rotulosItens: readonly string[]): string {
  return `${imovel} caiu de ${ROTULO_NIVEL[q.de]} para ${ROTULO_NIVEL[q.para]}: corrija ${rotulosItens.join(", ")}`;
}
