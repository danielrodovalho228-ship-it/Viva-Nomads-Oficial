/*
  E415 — a prova feita na hora não creditava o item na Qualificação. O resultado da Qualificação calculava o nível e a
  lista "Para subir a Conforto" SÓ pelas respostas (nivelDoResultado): o nível era "Essencial" ou nada, e um item já
  fotografado na hora (nivel_itens, em análise ou aceito) ou uma internet já medida seguia como "falta". Reaberta pelo
  botão "Qualificação" do rascunho (?draft=…&qualificacao=1), a tela contradizia o Passo 5 e o painel.
  Agora, com o rascunho salvo, o resultado usa o MESMO motor do Passo 5 (nivelAgoraEFalta) com as provas do imóvel:
  o nível real (pode ser Conforto ou Premium), o que já está provado e o que falta. Sem rascunho, segue o de antes.
  PURO. Roda: node --test src/lib/anuncio/qualificacao-nivel.test.ts
*/
import { VERSAO_CONFORTO } from "../../config/conforto-minimo.ts";
import { ROTULO_NIVEL, itemNivel, type ChaveNivel } from "../../config/niveis.ts";
import { nivelAgoraEFalta } from "../niveis/exibicao.ts";
import { itemConta, type EntradaNivel } from "../niveis/regras.ts";
import { jaTemDoConforto, nivelDoResultado, type Respostas } from "./qualificacao-conforto.ts";

/** As provas do rascunho (o que entradaNivelDoCadastro devolve), sem as declarações do essencial. */
export type ProvasDoRascunho = Pick<EntradaNivel, "itens" | "medidas" | "ruido" | "bloqueadas">;

export interface ResultadoNivelQualificacao {
  /** "Essencial", "Conforto", "Premium" ou null (falta o essencial). */
  nivel: string | null;
  /** O próximo nível (para o título da lista); null no mais alto ou sem o essencial. */
  proximo: string | null;
  /** O que falta para o próximo nível (rótulos). */
  paraSubir: string[];
  /** Itens do nível já provados (foto na hora em análise ou aceita): o crédito que faltava. */
  provados: string[];
}

export function nivelDaQualificacao(conforto: readonly string[], respostas: Respostas, provas: ProvasDoRascunho | null, agora: Date): ResultadoNivelQualificacao {
  if (!provas) {
    const r = nivelDoResultado(conforto, respostas);
    return { nivel: r.nivel, proximo: r.nivel ? "Conforto" : null, paraSubir: r.paraSubir, provados: [] };
  }
  const entrada: EntradaNivel = {
    declaracoesConforto: conforto.map((chave) => ({ chave, confirmado: true, versao_lista: VERSAO_CONFORTO })),
    itens: provas.itens,
    medidas: provas.medidas,
    ruido: provas.ruido,
    bloqueadas: provas.bloqueadas,
    agora,
  };
  const { nivel, proximo, falta } = nivelAgoraEFalta(entrada);
  // O que as respostas já dizem que o imóvel tem segue fora da lista (E179), como antes.
  const jaTem = new Set<string>(jaTemDoConforto(respostas));
  const paraSubir = falta.flatMap((g) => g.itens).filter((i) => !jaTem.has(i.chave)).map((i) => i.rotulo);
  const provados = provas.itens
    .filter((i) => !provas.bloqueadas.includes(i.chave) && itemConta(i, agora))
    .map((i) => itemNivel(i.chave as ChaveNivel).rotulo);
  return {
    nivel: nivel === "em_adequacao" ? null : ROTULO_NIVEL[nivel],
    proximo: nivel === "em_adequacao" || !proximo || proximo === "essencial" ? null : ROTULO_NIVEL[proximo],
    paraSubir,
    provados,
  };
}
