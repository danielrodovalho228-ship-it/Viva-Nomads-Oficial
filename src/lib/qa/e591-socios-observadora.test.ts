/*
  E591 (rodada de QA de 05/11 05:39): a observadora (qa_admin) abriu /admin/socios e recebeu o 404 genérico, sem link e
  sem dizer qual permissão a página exige — e as premissas do E559 não puderam ser conferidas.
  Definição: a Caixa dos Sócios é a CORRESPONDÊNCIA privada dos sócios e segue fechada à observadora (QA-LOGIN-B v2:
  página, ações, RLS da tabela e dos arquivos). As premissas do E559 NÃO moram nela: a fonte única é
  src/config/premissas-financeiras.ts, mostrada em /simulacao e /roi (código dos sócios). O /simulacao abre SÓ LEITURA
  com o código do investidor (sem escrita nenhuma) — é esse o acesso de leitura do QA.
  Correção: (1) no lugar do 404, a observadora vê o motivo e o caminho; (2) o ACESSO vai para a própria conta de QA, sem
  código: /admin/premissas mostra à observadora o MESMO modelo do /simulacao em modo leitura (o do investidor; o
  componente não grava nada) e a barra dela troca a Caixa por "Premissas (leitura)". Admin comum continua pela porta
  dos sócios (/simulacao com código): a regra "sem exceção para admin" das páginas internas não muda. A Caixa segue sem
  nenhuma leitura para a observadora (o aviso volta ANTES de listarCaixa; checagem que falha → error.tsx).
  Roda: node --test src/lib/qa/e591-socios-observadora.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEXTO_CAIXA_RESTRITA_QA } from "./observador-regras.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("observadora: aviso com o motivo e o caminho das premissas (não o 404), antes de qualquer leitura da Caixa", () => {
  const s = ler("app/(dashboard)/admin/socios/page.tsx");
  assert.match(s, /if \(await ehObservadorQa\(uidAtual\)\) return <CaixaRestritaQa \/>;/);
  assert.doesNotMatch(s, /notFound/);
  assert.ok(s.indexOf("return <CaixaRestritaQa />") < s.indexOf("await listarCaixa()"), "o aviso volta antes de ler a Caixa");
  const c = ler("app/(dashboard)/admin/socios/caixa-restrita-qa.tsx");
  assert.match(c, /href="\/admin\/premissas"/);
  assert.match(c, /data-testid="caixa-restrita-qa"/);
  assert.doesNotMatch(c, /listarCaixa|caixa_socios|enviarParaCaixa/);
});

test("o texto diz qual permissão abre o quê (sem número de premissa nem código no texto)", () => {
  assert.match(TEXTO_CAIXA_RESTRITA_QA.motivo, /restrita aos sócios/);
  assert.match(TEXTO_CAIXA_RESTRITA_QA.caminho, /Premissas \(leitura\)/);
  assert.match(TEXTO_CAIXA_RESTRITA_QA.caminho, /só leitura/);
});

test("a premissa continua com fonte única e o /simulacao continua em leitura para o investidor", () => {
  assert.match(ler("app/simulacao/page.tsx"), /<ModeloFinanceiro pagina="simulacao" leitura=\{investidor\} \/>/);
  assert.match(ler("config/premissas-financeiras.ts"), /fonte única de \/simulacao e \/roi/);
});

test("a RLS da Caixa (0252) segue fechada à observadora — nada muda no banco", () => {
  const m = readFileSync(new URL("../../../supabase/migrations/0252_qa_admin_observador.sql", import.meta.url), "utf8");
  assert.match(m, /using \(public\.is_admin\(\) and not public\.is_qa_admin\(auth\.uid\(\)\)\)/);
});

test("acesso da conta de QA: /admin/premissas = o modelo do /simulacao em leitura; admin comum vai à porta dos sócios", () => {
  const p = ler("app/(dashboard)/admin/premissas/page.tsx");
  assert.match(p, /if \(!\(await ehObservadorQa\(uid\)\)\) redirect\("\/simulacao"\);/);
  assert.match(p, /<ModeloFinanceiro pagina="simulacao" leitura \/>/);
  assert.doesNotMatch(p.replace(/\/\*[\s\S]*?\*\//g, ""), /listarCaixa|caixa_socios|caixa-actions/);
  // O modelo não grava nada (só cálculo no navegador).
  assert.doesNotMatch(ler("components/financeiro/modelo-financeiro.tsx"), /"use server"|from "@\/lib\/data\/|\.insert\(|\.update\(/);
});

test("barra da observadora: a Caixa sai e entra 'Premissas (leitura)'; o admin comum não vê essa entrada", async () => {
  const { barraAdminPara, BARRA_ADMIN, FORA_DA_BARRA_ADMIN } = await import("../../config/menu-admin.ts");
  const folhas = (itens: readonly { href?: string; filhos?: readonly { href?: string }[] }[]) => itens.flatMap((i) => (i.filhos ? i.filhos.map((f) => f.href) : [i.href]));
  const obs = folhas(barraAdminPara({ observadorQa: true }));
  assert.ok(obs.includes("/admin/premissas"));
  assert.ok(!obs.includes("/admin/socios"));
  assert.ok(!folhas(BARRA_ADMIN).includes("/admin/premissas"));
  assert.ok("/admin/premissas" in FORA_DA_BARRA_ADMIN);
});
