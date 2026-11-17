// Harness de teste (Pista 3, lote 2 — conversas e anexos): carrega o código REAL de src/lib/data/messages.ts
// (listConversations) e de src/app/api/mensagens/anexo/route.ts (POST) no node --test, trocando só as bordas — Supabase
// (sessão e serviço), limite de envios, NextResponse e leituras secundárias da lista (nomes, LinkedIn, vínculo, foto,
// contrato fechado, emergência) — por dublês. Regras de id, de origem da conversa, de tipo e de tamanho entram de verdade.
// Não entra no app; só os testes o registram.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pr } from "node:path";

const RAIZ = pr(dirname(fileURLToPath(import.meta.url)), "../../../..");
const G = "globalThis.__CONVERSA";
const STUBS = {
  "server-only": `export {};`,
  "next/server": `export const NextResponse = { json: (corpo, init) => new Response(JSON.stringify(corpo), { status: init?.status ?? 200, headers: { "content-type": "application/json" } }) };`,
  "@/lib/supabase/server": `export async function createClient() { return ${G}.sessao; }`,
  "@/lib/supabase/admin": `export function createAdminClient() { return ${G}.servico; }`,
  "@/lib/limites": `export const DIA = 86400; export async function consumirLimite(chave) { ${G}.limites.push(chave); return ${G}.limiteLivre; }`,
  "@/lib/linkedin/servidor": `export async function linkedinConectados() { return new Set(); }`,
  "@/lib/vinculo/servidor": `export async function vinculosConfirmados() { return new Map(); }`,
  "@/lib/data/avatar-url": `export async function relacaoAceitaEntreServidor() { return false; }`,
  "@/lib/perfil/perfil-publico": `export function nomeNaConversa(p) { return p.primeiroNome ?? "Conversa"; }`,
  "@/lib/seguranca/antigolpe": `export function contratoAssinadoEntrePartes() { return false; }`,
  "@/lib/data/parceiros-publico": `export function urlMidiaParceiro() { return null; }`,
  "@/lib/estadia/emergencia-chegada": `export function emergenciaDisponivel() { return false; }`,
  "@/lib/checkin": `export function hojeEmBrasilia() { return "2026-11-15"; }`,
};

export async function resolve(spec, ctx, next) {
  if (spec in STUBS) return { url: "conversa-harness:" + spec, shortCircuit: true };
  const tentar = (base) => {
    for (const ext of ["", ".ts"]) if (existsSync(base + ext) && /\.\w+$/.test(base + ext)) return pathToFileURL(base + ext).href;
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
  if (url.startsWith("conversa-harness:")) return { format: "module", source: STUBS[url.slice("conversa-harness:".length)], shortCircuit: true };
  return next(url, ctx);
}
