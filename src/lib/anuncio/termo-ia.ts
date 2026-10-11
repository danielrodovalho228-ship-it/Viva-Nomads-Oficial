/*
  Termo de aceite do anúncio feito com IA (ordem 04e2fe5e, item 5). O dono só
  publica depois de marcar que revisou e que a IA pode errar; o servidor grava
  o aceite (quem, quando, versão do termo, campos gerados x editados). PURO.
*/

/** Mudou o texto do termo? Troque a versão: o aceite antigo deixa de valer. */
export const TERMO_IA_VERSAO = "2026-10-11";
export const TERMO_IA_TEXTO =
  "Revisei as informações. Sei que a inteligência artificial pode errar e que sou responsável pelo que está no anúncio.";

export const CAMPOS_IA = ["title", "description"] as const;
export type CampoIa = (typeof CAMPOS_IA)[number];

export interface AceiteIa {
  versao: string;
  camposGeradosIa: CampoIa[];
  camposEditados: CampoIa[];
}

const ehCampo = (v: unknown): v is CampoIa => (CAMPOS_IA as readonly unknown[]).includes(v);

function lista(v: unknown): CampoIa[] | null {
  if (!Array.isArray(v) || v.length > CAMPOS_IA.length * 2) return null;
  if (!v.every(ehCampo)) return null;
  return [...new Set(v)];
}

/** Valida o aceite vindo do cliente (nunca confie na forma). */
export function validarAceiteIa(x: unknown): { ok: true; aceite: AceiteIa } | { ok: false } {
  if (!x || typeof x !== "object" || Array.isArray(x)) return { ok: false };
  const o = x as Record<string, unknown>;
  if (o.versao !== TERMO_IA_VERSAO) return { ok: false };
  const gerados = lista(o.camposGeradosIa);
  const editados = lista(o.camposEditados);
  if (!gerados || !editados) return { ok: false };
  return { ok: true, aceite: { versao: TERMO_IA_VERSAO, camposGeradosIa: gerados, camposEditados: editados } };
}

/** Quais campos a IA escreveu e quais o dono mexeu depois (sem o original, nenhum conta como editado). */
export function camposDaIa(a: {
  geradoPorIa: boolean;
  titulo: string;
  descricao: string;
  original?: { titulo: string; descricao: string };
}): { camposGeradosIa: CampoIa[]; camposEditados: CampoIa[] } {
  if (!a.geradoPorIa) return { camposGeradosIa: [], camposEditados: [] };
  const editados: CampoIa[] = [];
  if (a.original) {
    if (a.titulo !== a.original.titulo) editados.push("title");
    if (a.descricao !== a.original.descricao) editados.push("description");
  }
  return { camposGeradosIa: ["title", "description"], camposEditados: editados };
}

/** Aceite enviado pelo editor por seções: só existe com a caixa marcada; o editor não gera texto por IA. */
export function aceiteDoEditor(marcado: boolean): AceiteIa | undefined {
  if (!marcado) return undefined;
  return { versao: TERMO_IA_VERSAO, ...camposDaIa({ geradoPorIa: false, titulo: "", descricao: "" }) };
}
