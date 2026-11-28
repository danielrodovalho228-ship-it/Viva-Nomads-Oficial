// Harness de teste (E1248 PR 1, a máquina da devolução da caução): carrega as AÇÕES REAIS do registro, da resposta, do
// anexo e da decisão da Central (src/lib/data/documentos-actions.ts e src/lib/data/devolucao-caucao-actions.ts) e a
// ROTINA REAL de hora a hora (src/lib/caucao/devolucao-servidor.ts) no node --test, trocando só as bordas por dublês:
//  - os clientes Supabase da sessão e de serviço (globalThis.__e1248Sessao / __e1248Admin, o banco falso do teste);
//  - o portão da equipe (__e1248EhEquipe) e a conta observadora (__e1248Observador: a mensagem de recusa, ou nada);
//  - a abertura do chamado (grava a linha no banco falso e em __e1248Chamados) e a resposta da equipe (__e1248Respostas);
//  - o termo em PDF (__e1248Termos) e a remoção dos metadados da imagem (devolve os bytes, marcados);
//  - o envio do notify: guarda cada chamada (__e1248Envios) e grava o aviso pela gravarAviso REAL, no banco falso.
// As regras, os prazos, a renovação e a resolução dos avisos entram de verdade.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pr } from "node:path";

const RAIZ = pr(dirname(fileURLToPath(import.meta.url)), "../../../..");
const STUBS = {
  "server-only": `export {};`,
  "next/server": `export function after(fn) { return typeof fn === "function" ? fn() : undefined; }`,
  "next/cache": `export function revalidatePath() {}`,
  "@/lib/supabase/server": `export async function createClient() { return globalThis.__e1248Sessao ?? null; }`,
  "@/lib/supabase/admin": `export function createAdminClient() { return globalThis.__e1248Admin ?? null; }`,
  "@/lib/data/admin-guard": `export async function ehAdmin() { return globalThis.__e1248EhEquipe === true; }`,
  "@/lib/qa/observador": `export async function recusaObservador() { return globalThis.__e1248Observador ?? null; }`,
  "@/lib/limites": `export const HORA = 3600; export const DIA = 86400; export async function consumirLimite() { return true; }`,
  "@/lib/foto-reconversao": `export async function semMetadados(bytes) { (globalThis.__e1248Limpos ??= []).push(bytes.length); return bytes; }`,
  "@/lib/fiscal/emitir": `export async function emitirTermoDevolucaoComRegistro(id) { (globalThis.__e1248Termos ??= []).push(id); return null; }
    export async function emitirDoPagamentoComRegistro() { return null; } export async function emitirTermoDevolucao() { return { ok: true }; }`,
  "@/lib/atendimento/servidor": `export async function avisarUsuario(c, ev) { (globalThis.__e1248AvisosAtendimento ??= []).push({ quem: "usuario", id: c.id, ev }); }
    export async function avisarEquipe(c, motivo) { (globalThis.__e1248AvisosAtendimento ??= []).push({ quem: "equipe", id: c.id, motivo }); }`,
  "@/lib/data/atendimento-actions": `export async function abrirChamado(input) {
    if (globalThis.__e1248FalhaChamado) return { ok: false, error: "Não foi possível abrir o chamado agora. Tente de novo em instantes." };
    (globalThis.__e1248Chamados ??= []).push(input);
    const n = (globalThis.__e1248Chamados).length;
    const numero = "CH-2026-00090" + n;
    const sessao = globalThis.__e1248Sessao;
    const uid = sessao ? (await sessao.auth.getUser()).data.user?.id ?? null : null;
    await globalThis.__e1248Admin.from("chamados").insert({ id: globalThis.crypto.randomUUID(), numero_publico: numero, usuario_id: uid, categoria: input.categoria, contexto_tipo: input.contextoTipo ?? null, contexto_id: input.contextoId ?? null, prioridade: "p2", simulacao: false, prazo_resolucao: "2026-12-20T00:00:00.000Z", criado_em: new Date().toISOString() });
    return { ok: true, numero, aviso: "", emergencia: false };
  }
  export async function responderComoAdmin(id, texto, interno) { (globalThis.__e1248Respostas ??= []).push({ id, texto, interno }); return { ok: true }; }`,
  "@/lib/notifications": `import { gravarAviso } from "@/lib/notifications/avisos-servidor";
    export async function notify(p) {
      (globalThis.__e1248Envios ??= []).push(p);
      if (globalThis.__e1248FalhaNotify) throw new Error("o envio falhou");
      if (p.userId) await gravarAviso({ usuarioId: p.userId, evento: p.event, papel: p.papelAviso, url: p.pushUrl, refId: p.refId, prioridade: p.prioridadeAviso, titulo: p.tituloAviso, texto: p.textoAviso });
      return { email: true, whatsapp: false };
    }`,
};

export async function resolve(spec, ctx, next) {
  if (spec in STUBS) return { url: "e1248:" + spec, shortCircuit: true };
  const tentar = (base) => {
    for (const ext of ["", ".ts", ".tsx"]) if (existsSync(base + ext) && /\.\w+$/.test(base + ext)) return pathToFileURL(base + ext).href;
    return null;
  };
  if (spec.startsWith("@/")) {
    const url = tentar(pr(RAIZ, "src", spec.slice(2)));
    if (url) return { url, shortCircuit: true };
  }
  if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL?.startsWith("file:") && !/\.\w+$/.test(spec)) {
    const url = tentar(pr(dirname(fileURLToPath(ctx.parentURL)), spec));
    if (url) return { url, shortCircuit: true };
  }
  return next(spec, ctx);
}

export async function load(url, ctx, next) {
  if (url.startsWith("e1248:")) return { format: "module", source: STUBS[url.slice("e1248:".length)], shortCircuit: true };
  return next(url, ctx);
}
