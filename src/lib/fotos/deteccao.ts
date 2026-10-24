/*
  DETECTA-B — o que as fotos da galeria mostram, como SUGESTÃO (PURO e testável).
  • Lista FECHADA: os itens de Conforto/Premium provados por foto (src/config/niveis.ts) e as comodidades estruturadas
    que os filtros da busca leem (src/lib/busca/filtro-comodidades.ts). Chave fora da lista é descartada.
  • Sugestão NUNCA conta para o nível nem marca comodidade. FOTO-NA-HORA-B: a foto da galeria não vira prova; confirmar
    um item de nível abre a câmera (CameraProva) e o item só conta quando a foto feita na hora chega (salvarItemNivel
    com o token). Sem a foto, a sugestão fica "Confirmada, falta a foto". A comodidade segue pelo salvar do anúncio.
  • Foto com pessoa não serve de prova: tudo o que veio dela é descartado e a tela avisa.
  • Chave DETECCAO_FOTOS_ATIVO desligada: nada é enviado e a tela fica como hoje.
*/
import { CHAVES_NIVEL_FOTO, MATRIZ, itemNivel, type ChaveNivel } from "../../config/niveis.ts";
import { COMODIDADES_FILTRO } from "../busca/filtro-comodidades.ts";
import { AMENITY_LABEL } from "../amenities.ts";
import type { ItemQueFalta } from "../niveis/exibicao.ts";
import type { Area } from "../../config/niveis.ts";

export type TipoDeteccao = "nivel" | "comodidade";
export type StatusSugestao = "sugerida" | "aceita" | "descartada" | "confirmada_sem_foto";

export interface ChaveDeteccao {
  chave: string;
  tipo: TipoDeteccao;
  rotulo: string;
  criterio: string;
}

/** Itens de nível provados por foto que entram em Conforto ou Premium (o Essencial é o padrão mínimo, não vem daqui). */
const CHAVES_NIVEL_DETECCAO: ChaveNivel[] = CHAVES_NIVEL_FOTO.filter((k) =>
  Object.values(MATRIZ).some((m) => m.conforto.includes(k) || m.premium.includes(k)),
);

export const CHAVES_DETECCAO: readonly ChaveDeteccao[] = [
  ...CHAVES_NIVEL_DETECCAO.map((k) => {
    const i = itemNivel(k);
    return { chave: k, tipo: "nivel" as const, rotulo: i.rotulo, criterio: i.criterio };
  }),
  ...COMODIDADES_FILTRO.map((c) => ({ chave: c.amenityKey, tipo: "comodidade" as const, rotulo: AMENITY_LABEL[c.amenityKey] ?? c.rotulo, criterio: c.dica })),
];

const POR_CHAVE = new Map(CHAVES_DETECCAO.map((c) => [c.chave, c]));
export const chaveDeteccao = (chave: string): ChaveDeteccao | undefined => POR_CHAVE.get(chave);

/** Abaixo disto a sugestão não aparece (o dono não perde tempo com palpite). */
export const CONFIANCA_MINIMA = 0.6;

/** Modelo e travas. O modelo é trocável aqui; o custo de cada um está em estimativaCusto (PR do DETECTA-B). */
export const MODELO_DETECCAO = "claude-opus-5-5";
/** Lado maior da imagem mandada ao modelo (a foto da galeria tem até 2560 px; 1024 px basta para achar o item). */
export const LADO_DETECCAO_PX = 1024;
/** Fotos analisadas por dia: por anúncio (a galeria tem no máximo 40) e por dono (vários anúncios). */
export const LIMITE_FOTOS_DIA_ANUNCIO = 40;
export const LIMITE_FOTOS_DIA_DONO = 120;
/** Fotos por rodada (a tela pede de novo enquanto restar foto nova). */
export const FOTOS_POR_RODADA = 6;
export const AVISO_FOTO_COM_PESSOA = "Foto com pessoa não serve de prova";

/** Ligada: a chave em produção, ou o laboratório com o cookie do teste. Desligada: nada sai do servidor. */
export function deteccaoLigada(env: { chave: boolean; simulado: boolean; cookieLab: boolean }): boolean {
  return env.chave || (env.simulado && env.cookieLab);
}

/** Caminho da foto da galeria no bucket, só da pasta do dono (só referência: a foto da galeria não serve de prova). */
const CAMINHO_FOTO = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i;
export function caminhoDaGaleria(url: string, ownerId: string): string | null {
  const marca = "/object/public/property-photos/";
  const i = typeof url === "string" ? url.indexOf(marca) : -1;
  if (i < 0) return null;
  let c: string;
  try {
    c = decodeURIComponent(url.slice(i + marca.length).split("?")[0]);
  } catch {
    return null;
  }
  return CAMINHO_FOTO.test(c) && c.startsWith(`${ownerId}/`) ? c : null;
}

export const DETECCAO_SYSTEM_PROMPT = [
  "Você confere UMA foto de um imóvel anunciado para morar por meses.",
  "Diga quais itens da lista abaixo aparecem com clareza na foto, cada um com a confiança de 0 a 1.",
  "Só use chaves da lista. Item que não aparece não entra. Não adivinhe pelo tipo de cômodo.",
  "Se houver qualquer pessoa na foto (inteira ou em parte, inclusive reflexo), marque pessoa = true.",
  "",
  "Lista (chave — item — critério):",
  ...CHAVES_DETECCAO.map((c) => `- ${c.chave} — ${c.rotulo} — ${c.criterio}`),
].join("\n");

export const DETECCAO_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["pessoa", "itens"],
  properties: {
    pessoa: { type: "boolean" },
    itens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["chave", "confianca"],
        properties: { chave: { type: "string", enum: CHAVES_DETECCAO.map((c) => c.chave) }, confianca: { type: "number" } },
      },
    },
  },
} as const;

export interface ItemDetectado {
  chave: string;
  tipo: TipoDeteccao;
  confianca: number;
}

export type ResultadoDeteccao = { ok: true; pessoa: boolean; itens: ItemDetectado[] } | { ok: false };

/**
 * Valida no servidor o que o modelo devolveu: objeto com `pessoa` e `itens`; chave fora da lista sai; confiança vira
 * número entre 0 e 1 (com duas casas); repetida fica a maior; abaixo da mínima sai. Qualquer outra forma = inválido.
 */
export function validarDeteccao(bruto: unknown): ResultadoDeteccao {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return { ok: false };
  const o = bruto as Record<string, unknown>;
  if (typeof o.pessoa !== "boolean" || !Array.isArray(o.itens)) return { ok: false };
  const melhor = new Map<string, ItemDetectado>();
  for (const x of o.itens) {
    if (!x || typeof x !== "object") continue;
    const { chave, confianca } = x as Record<string, unknown>;
    const def = typeof chave === "string" ? POR_CHAVE.get(chave) : undefined;
    const n = typeof confianca === "number" && Number.isFinite(confianca) ? Math.round(Math.min(1, Math.max(0, confianca)) * 100) / 100 : null;
    if (!def || n === null || n < CONFIANCA_MINIMA) continue;
    const atual = melhor.get(def.chave);
    if (!atual || atual.confianca < n) melhor.set(def.chave, { chave: def.chave, tipo: def.tipo, confianca: n });
  }
  return { ok: true, pessoa: o.pessoa, itens: [...melhor.values()].sort((a, b) => b.confianca - a.confianca) };
}

export interface LinhaSugestao {
  chave: string;
  tipo: TipoDeteccao;
  confianca: number;
  status: StatusSugestao;
  motivo: "pessoa" | null;
}

/** O que grava de uma foto analisada: foto com pessoa → tudo descartado (motivo pessoa); senão, tudo sugerido. */
export function linhasDaAnalise(r: { pessoa: boolean; itens: ItemDetectado[] }): LinhaSugestao[] {
  return r.itens.map((i) => ({ ...i, status: r.pessoa ? "descartada" : "sugerida", motivo: r.pessoa ? "pessoa" : null }));
}

export interface SugestaoVisivel {
  id: string;
  chave: string;
  tipo: TipoDeteccao;
  confianca: number;
  status: StatusSugestao;
  caminho: string;
}

/**
 * O que a tela mostra para o dono confirmar: 'sugerida' (e, de item de nível, 'confirmada_sem_foto' — falta a foto da
 * câmera), só de foto que ainda está na galeria, sem item de nível que já tem foto valendo e sem comodidade já marcada.
 * Uma por chave (a confirmada primeiro; depois a de maior confiança).
 */
export function sugestoesParaConfirmar(
  todas: readonly SugestaoVisivel[],
  ctx: { galeria: ReadonlySet<string>; nivelComFoto: ReadonlySet<string>; comodidadesMarcadas: ReadonlySet<string> },
): SugestaoVisivel[] {
  const porChave = new Map<string, SugestaoVisivel>();
  for (const s of todas) {
    const aberta = s.status === "sugerida" || (s.status === "confirmada_sem_foto" && s.tipo === "nivel");
    if (!aberta || !ctx.galeria.has(s.caminho) || !POR_CHAVE.has(s.chave)) continue;
    if (s.tipo === "nivel" && ctx.nivelComFoto.has(s.chave)) continue;
    if (s.tipo === "comodidade" && ctx.comodidadesMarcadas.has(s.chave)) continue;
    const atual = porChave.get(s.chave);
    const confirmada = (x: SugestaoVisivel) => (x.status === "confirmada_sem_foto" ? 1 : 0);
    if (!atual || confirmada(s) > confirmada(atual) || (confirmada(s) === confirmada(atual) && atual.confianca < s.confianca)) porChave.set(s.chave, s);
  }
  return [...porChave.values()].sort((a, b) => b.confianca - a.confianca);
}

/**
 * "O que falta" para o próximo nível: os itens sem foto aceita (o que nivelAgoraEFalta já devolve) E sem sugestão
 * esperando confirmação. O item sugerido aparece na lista de sugestões, não aqui.
 */
export function faltaSemSugestao(
  falta: readonly { area: Area; itens: ItemQueFalta[] }[],
  sugeridas: ReadonlySet<string>,
): { area: Area; itens: ItemQueFalta[] }[] {
  return falta.map((g) => ({ area: g.area, itens: g.itens.filter((i) => !sugeridas.has(i.chave)) })).filter((g) => g.itens.length > 0);
}

/** Confiança para a tela: "92%". */
export const rotuloConfianca = (c: number): string => `${Math.round(c * 100)}%`;

/* ---------- Custo estimado (o Daniel decide se liga) ---------- */

/** Preço por milhão de tokens (USD), entrada/saída, da tabela da Anthropic (out/2026). */
export const PRECO_USD_MTOK: Record<string, { entrada: number; saida: number }> = {
  "claude-opus-5-5": { entrada: 4, saida: 20 },
  "claude-sonnet-5-5": { entrada: 2, saida: 10 },
  "claude-haiku-5-5": { entrada: 0.1, saida: 0.5 },
};

/** Tokens de uma imagem: largura × altura ÷ 750 (regra da documentação da Anthropic). */
export const tokensDaImagem = (largura: number, altura: number): number => Math.ceil((largura * altura) / 750);

/** Texto fixo (instruções + lista) em tokens, pela regra prática de ~4 caracteres por token. */
export const tokensDoPrompt = (): number => Math.ceil(DETECCAO_SYSTEM_PROMPT.length / 4) + 30;

export interface EstimativaCusto {
  modelo: string;
  tokensEntradaPorFoto: number;
  tokensSaidaPorFoto: number;
  usdPorFoto: number;
  usdPorAnuncio: number;
  fotosPorAnuncio: number;
}

/**
 * Custo por foto e por anúncio. Foto 1024×768 (4:3, o lado maior que vai ao modelo), o texto fixo e a resposta
 * (até ~150 tokens: pessoa + alguns itens com confiança). Cada foto é analisada uma vez só (cache por hash).
 */
export function estimativaCusto(modelo: string = MODELO_DETECCAO, fotosPorAnuncio = 20, tokensSaidaPorFoto = 150): EstimativaCusto {
  const p = PRECO_USD_MTOK[modelo] ?? PRECO_USD_MTOK[MODELO_DETECCAO];
  const entrada = tokensDaImagem(LADO_DETECCAO_PX, Math.round((LADO_DETECCAO_PX * 3) / 4)) + tokensDoPrompt();
  const usdPorFoto = (entrada * p.entrada + tokensSaidaPorFoto * p.saida) / 1_000_000;
  return {
    modelo,
    tokensEntradaPorFoto: entrada,
    tokensSaidaPorFoto,
    usdPorFoto: Math.round(usdPorFoto * 100_000) / 100_000,
    usdPorAnuncio: Math.round(usdPorFoto * fotosPorAnuncio * 10_000) / 10_000,
    fotosPorAnuncio,
  };
}

/* ---------- Laboratório: resposta fixa, nada sai para a rede ---------- */

/**
 * Laboratório (INTEGRACOES_SIMULADAS=on): a 1ª foto mostra micro-ondas e máquina de lavar (e uma chave inventada, que
 * a validação descarta); a 2ª tem uma pessoa (tudo descartado + aviso); a 3ª devolve lixo (JSON inválido não quebra a
 * tela); as outras, nada.
 */
export function respostaLab(indice: number): unknown {
  if (indice === 0)
    return { pessoa: false, itens: [{ chave: "cozinha_microondas", confianca: 0.93 }, { chave: "maquina_lavar", confianca: 0.81 }, { chave: "piscina_aquecida", confianca: 0.99 }] };
  if (indice === 1) return { pessoa: true, itens: [{ chave: "sala_assentos", confianca: 0.9 }] };
  if (indice === 2) return "isto não é JSON de detecção";
  return { pessoa: false, itens: [] };
}

/* ---------- Contador do admin ---------- */

/** Fotos analisadas por dia (dia de Brasília já calculado), dos últimos `dias`, do mais recente ao mais antigo, com zero nos dias sem análise. */
export function fotosPorDia(diasDasAnalises: readonly (string | null)[], hoje: string, dias = 7): { dia: string; fotos: number }[] {
  const conta = new Map<string, number>();
  for (const d of diasDasAnalises) if (d) conta.set(d, (conta.get(d) ?? 0) + 1);
  const [a, m, d] = hoje.split("-").map(Number);
  return Array.from({ length: dias }, (_, i) => {
    const dia = new Date(Date.UTC(a, m - 1, d - i)).toISOString().slice(0, 10);
    return { dia, fotos: conta.get(dia) ?? 0 };
  });
}
