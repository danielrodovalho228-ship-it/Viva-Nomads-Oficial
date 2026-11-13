/*
  E876 (RELATORIO-021, A-113) — o "Fale com a gente" de /empresas prometia só "retornamos com o que dá para fazer hoje".
  Diagnóstico no código: o envio vai para POST /api/empresas → leads_empresas + push ao Daniel + e-mail interno; quem
  responde é a equipe, por e-mail. Agora o formulário diz o prazo próprio (7 dias, o mesmo da página), na página e no
  recibo do envio. Roda: node --test src/lib/e876-empresas-form-prazo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DIAS_RETORNO_EMPRESAS, TEXTO_RETORNO_EMPRESAS } from "./empresas-lead.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const pagina = ler("app/(public)/empresas/page.tsx");
const form = ler("app/(public)/empresas/empresas-form.tsx");
const rota = ler("app/api/empresas/route.ts");

test("o prazo do formulário é um só, 7 dias, igual ao que a página já promete à empresa", () => {
  assert.equal(DIAS_RETORNO_EMPRESAS, 7);
  assert.equal(TEXTO_RETORNO_EMPRESAS, "A equipe da Viva responde no e-mail informado em até 7 dias.");
  assert.match(pagina, /A equipe responde em até 7 dias, no e-mail informado/);
});

test("a promessa vaga saiu; a página e o recibo do envio dizem o prazo, da mesma fonte", () => {
  assert.doesNotMatch(pagina, /retornamos com o que dá para fazer hoje/);
  assert.match(pagina, /Conte seu volume e sua necessidade\. \{TEXTO_RETORNO_EMPRESAS\}/);
  assert.match(form, /\{TEXTO_RETORNO_EMPRESAS\} Obrigado pelo interesse\./);
  assert.doesNotMatch(form, /Nosso time responde no e-mail informado\. Obrigado/);
});

test("o destino do envio é o diagnosticado: /api/empresas grava o lead, avisa o Daniel e manda o e-mail interno", () => {
  assert.match(form, /fetch\("\/api\/empresas"/);
  assert.match(rota, /gravarLead\(createAdminClient\(\), lead\)/);
  assert.match(rota, /pushParaCeo\(/);
  assert.match(rota, /process\.env\.EMPRESAS_LEAD_EMAIL \?\? SUPORTE_EMAIL/);
  assert.match(rota, /interno: true/);
});
