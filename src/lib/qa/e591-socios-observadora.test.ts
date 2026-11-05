/*
  E591 (rodada de QA de 05/11 05:39): a observadora (qa_admin) abriu /admin/socios e recebeu o 404 genérico, sem link e
  sem dizer qual permissão a página exige — e as premissas do E559 não puderam ser conferidas.
  Definição: a Caixa dos Sócios é a CORRESPONDÊNCIA privada dos sócios e segue fechada à observadora (QA-LOGIN-B v2:
  página, ações, RLS da tabela e dos arquivos). As premissas do E559 NÃO moram nela: a fonte única é
  src/config/premissas-financeiras.ts, mostrada em /simulacao e /roi (código dos sócios). O /simulacao abre SÓ LEITURA
  com o código do investidor (sem escrita nenhuma) — é esse o acesso de leitura do QA.
  Correção: no lugar do 404, a observadora vê o motivo e o caminho (aviso com o link do /simulacao em leitura). A Caixa
  continua sem nenhuma leitura para ela (o aviso volta ANTES de listarCaixa; checagem que falha → error.tsx).
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
  assert.match(c, /href="\/simulacao"/);
  assert.match(c, /data-testid="caixa-restrita-qa"/);
  assert.doesNotMatch(c, /listarCaixa|caixa_socios|enviarParaCaixa/);
});

test("o texto diz qual permissão abre o quê (sem número de premissa nem código no texto)", () => {
  assert.match(TEXTO_CAIXA_RESTRITA_QA.motivo, /restrita aos sócios/);
  assert.match(TEXTO_CAIXA_RESTRITA_QA.caminho, /\/simulacao/);
  assert.match(TEXTO_CAIXA_RESTRITA_QA.caminho, /código do investidor/);
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
