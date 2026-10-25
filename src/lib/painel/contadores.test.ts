/*
  Prompt 42, item 5 — contadores do menu por UM GET, sem server actions na casca.
  Roda: node --test src/lib/painel/contadores.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CONTADORES_VAZIOS,
  EVENTOS_CONTADORES,
  EVENTO_CONTADORES,
  INTERVALO_CONTADORES_MS,
  ROTA_CONTADORES,
  badgeDaEquipe,
  contadoresVisiveis,
  normalizarContadores,
} from "./contadores.ts";
import { EVENTO_FILA_DOCUMENTOS } from "../admin/fila-evento.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const SHELL = "src/components/layout/dashboard-shell.tsx";
const ROTA = "src/app/api/painel/contadores/route.ts";
const SERVIDOR = "src/lib/painel/contadores-servidor.ts";
const LAYOUT = "src/app/(dashboard)/layout.tsx";
const PROVEDOR = "src/components/painel/contadores-iniciais.tsx";

test("resposta completa vira os contadores; o formato é fechado (sem campo a mais)", () => {
  const c = normalizarContadores({
    contratosParaAssinar: 1,
    propostasAguardando: 2,
    documentosPendentes: 3,
    aprovacoesPendentes: 4,
    temImovel: true,
    imoveisAtivos: 3,
    parceiro: true,
    estadiaAtiva: true,
    extra: "não passa",
  });
  assert.deepEqual(c, {
    contratosParaAssinar: 1,
    propostasAguardando: 2,
    documentosPendentes: 3,
    aprovacoesPendentes: 4,
    temImovel: true,
    imoveisAtivos: 3,
    parceiro: true,
    estadiaAtiva: true,
  });
});

test("lixo, ausente, negativo ou texto vira 0/false — o menu nunca quebra nem mostra número inventado", () => {
  assert.deepEqual(normalizarContadores(null), CONTADORES_VAZIOS);
  assert.deepEqual(normalizarContadores("x"), CONTADORES_VAZIOS);
  assert.deepEqual(normalizarContadores({ error: "Não autenticado." }), CONTADORES_VAZIOS);
  const c = normalizarContadores({ contratosParaAssinar: -2, propostasAguardando: "3", imoveisAtivos: 2.7, temImovel: "true", parceiro: 1 });
  assert.equal(c.contratosParaAssinar, 0);
  assert.equal(c.propostasAguardando, 0);
  assert.equal(c.imoveisAtivos, 2);
  assert.equal(c.temImovel, false);
  assert.equal(c.parceiro, false);
});

test("números da equipe só para admin; o selo Equipe da barra soma documentos e aprovações", () => {
  const c = normalizarContadores({ documentosPendentes: 2, aprovacoesPendentes: 1, propostasAguardando: 4 });
  assert.equal(contadoresVisiveis(c, false).documentosPendentes, 0);
  assert.equal(contadoresVisiveis(c, false).aprovacoesPendentes, 0);
  assert.equal(contadoresVisiveis(c, false).propostasAguardando, 4);
  assert.deepEqual(contadoresVisiveis(c, true), c);
  assert.equal(badgeDaEquipe(c), 3);
});

test("rota, intervalo e eventos que pedem nova leitura", () => {
  assert.equal(ROTA_CONTADORES, "/api/painel/contadores");
  assert.equal(INTERVALO_CONTADORES_MS, 60_000);
  assert.ok(EVENTOS_CONTADORES.includes(EVENTO_CONTADORES));
  assert.ok(EVENTOS_CONTADORES.includes(EVENTO_FILA_DOCUMENTOS));
});

test("guarda: a casca não importa mais as server actions dos contadores nem do contexto do menu", () => {
  const s = ler(SHELL);
  for (const acao of [
    "countDocumentosPendentes",
    "contarContratosParaAssinar",
    "contarPropostasAguardando",
    "contarAprovacoesPendentes",
    "temImovelAnunciado",
    "imoveisAtivosDoDono",
    "temPapelParceiro",
    "getMinhasLocacoes",
    "useHasActiveLocacao",
  ]) {
    assert.doesNotMatch(s, new RegExp(`\\b${acao}\\b`), acao);
  }
  for (const m of ["@/lib/data/documentos-admin", "@/lib/data/contratos-actions", "@/lib/data/propostas-actions", "@/lib/data/agentes-actions", "@/lib/data/menu-actions", "@/lib/parceiros/painel-actions"]) {
    assert.ok(!s.includes(`from "${m}"`), m);
  }
});

test("guarda: a casca lê por fetch GET, aborta ao desmontar e não relê a cada troca de rota", () => {
  const s = ler(SHELL);
  assert.match(s, /fetch\(ROTA_CONTADORES, \{ cache: "no-store", credentials: "same-origin", signal: controle\.signal \}\)/);
  assert.match(s, /return \(\) => controle\.abort\(\);/);
  // A leitura depende do usuário, da área de imóveis e do pedido de releitura — nunca do pathname inteiro.
  assert.match(s, /\}, \[displayUser\?\.id, naAreaDeImoveis, releitura\]\);/);
  // O único efeito que depende do pathname é o guarda de papel (não lê nada do servidor).
  const comPathname = [...s.matchAll(/\}, \[([^\]]*)\]\);/g)].map((m) => m[1]).filter((d) => /\bpathname\b/.test(d));
  assert.deepEqual(comPathname, ["pathname, mode, isOwner, isTenant, router, setActiveMode"]);
  assert.match(s, /window\.addEventListener\("focus", aoVoltar\)/);
  assert.match(s, /window\.setInterval\(aoVoltar, INTERVALO_CONTADORES_MS\)/);
  assert.match(s, /document\.visibilityState === "visible"/);
  // Selos idênticos: as mesmas chaves do menu e a mesma soma na barra inferior.
  assert.match(s, /"admin-documentos": docsPendentes, "admin-agentes": aprovacoesPendentes, "contratos-inquilino": contratosParaAssinar, "propostas-inquilino": propostasAguardando/);
  assert.match(s, /badges=\{\{ equipe: badgeDaEquipe\(contadores\) \}\}/);
});

test("a rota é GET, sem cache, autentica pela sessão do servidor e só conta o que a conta pode ver", () => {
  const r = ler(ROTA);
  assert.match(r, /export async function GET\(\)/);
  assert.doesNotMatch(r, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.match(r, /export const dynamic = "force-dynamic"/);
  assert.match(r, /"Cache-Control": "no-store"/);
  assert.match(r, /status: 401/);
  // PROP-0: as contagens moram numa função só, a mesma do layout.
  assert.match(r, /from "@\/lib\/painel\/contadores-servidor"/);
  assert.match(r, /const c = await contadoresDoPainel\(\);/);
  const s = ler(SERVIDOR);
  assert.match(s, /from "@\/lib\/supabase\/server"/);
  assert.match(s, /if \(!user\) return "sem-sessao";/);
  assert.match(s, /admin \? countDocumentosPendentes\(\)/);
  assert.match(s, /admin \? contarAprovacoesPendentes\(\)/);
  assert.match(s, /return contadoresVisiveis\(c, admin\);/);
});

test("PROP-0: o layout do painel resolve o contexto do menu no servidor e entrega à casca na 1ª pintura", () => {
  const l = ler(LAYOUT);
  assert.match(l, /const \[initialMode, contadoresIniciais\] = await Promise\.all\(\[resolveInitialMode\(\), contadoresIniciaisDoPainel\(\)\]\);/);
  assert.match(l, /<ContadoresIniciais valor=\{contadoresIniciais\}>\s*<DashboardShell>\{children\}<\/DashboardShell>\s*<\/ContadoresIniciais>/);
  const s = ler(SERVIDOR);
  // Falha ou sem sessão: null (a casca segue com a rota); nunca derruba o painel.
  assert.match(s, /const r = await contadoresDoPainel\(\)\.catch\(\(\) => null\);\n\s+return r && r !== "sem-sessao" \? r : null;/);
  const p = ler(PROVEDOR);
  assert.match(p, /^"use client";/);
  assert.match(p, /createContext<ContadoresPainel \| null>\(null\)/);
  assert.match(p, /export function useContadoresIniciais\(\): ContadoresPainel \| null/);
});
