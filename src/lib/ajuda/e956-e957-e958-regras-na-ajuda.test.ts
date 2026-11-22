/*
  Lote da Ajuda (Família 6): E956 (pré-aceite), E957 (CPF/RG recusado com aviso), E958 metade E948 (prazos da Viva).
  As três superfícies — Ajuda (temas Morador, Contratos, Segurança), /como-funciona e a home — declaram as regras,
  a partir de lib/ajuda/regras-publicas.ts. O pré-aceite só aparece com a chave PRE_ACEITACAO_72H_ATIVA ligada.
  Roda: node --test src/lib/ajuda/e956-e957-e958-regras-na-ajuda.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { FAQ } from "../atendimento/faq.ts";
import { TEMAS_AJUDA } from "./temas.ts";
import { regrasPublicas, TEXTO_DOCUMENTO_NA_MENSAGEM, TEXTO_PRAZOS_DA_VIVA, TEXTO_PRE_ACEITE } from "./regras-publicas.ts";
import { MAX_REABERTURAS, PRAZO_PRE_ACEITACAO_HORAS } from "../propostas/pre-aceitacao.ts";
import { PRAZO_CANAL } from "../../config/prazos-canais.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const resposta = (id: string) => FAQ.find((p) => p.id === id)?.resposta ?? "";
const doTema = (id: string) => TEMAS_AJUDA.find((t) => t.id === id)?.perguntas ?? [];

test("E956 — o texto do pré-aceite sai da regra: menor entre as 72 h e a entrada, taxa congela, reaberturas", () => {
  assert.match(TEXTO_PRE_ACEITE, new RegExp(`${PRAZO_PRE_ACEITACAO_HORAS} horas corridas`));
  assert.match(TEXTO_PRE_ACEITE, /data de entrada, se ela chegar antes \(vale o que terminar primeiro\)/);
  assert.match(TEXTO_PRE_ACEITE, /taxa de serviço congela no pré-aceite/);
  assert.match(TEXTO_PRE_ACEITE, new RegExp(`até ${MAX_REABERTURAS} vezes`));
});

test("E956 — chave ligada: a pergunta do pré-aceite existe e está nos temas Morador e Contratos; desligada, não aparece", () => {
  const roda = (valor: string) =>
    execFileSync(
      process.execPath,
      ["--input-type=module", "-e", `import { FAQ } from "./src/lib/atendimento/faq.ts"; import { TEMAS_AJUDA } from "./src/lib/ajuda/temas.ts";
       const p = FAQ.find((x) => x.id === "pre-aceite");
       console.log(JSON.stringify({ resposta: p?.resposta ?? null, temas: TEMAS_AJUDA.filter((t) => t.perguntas.includes("pre-aceite")).map((t) => t.id) }));`],
      { env: { ...process.env, NEXT_PUBLIC_PRE_ACEITACAO_72H_ATIVA: valor }, encoding: "utf8" },
    );
  const ligada = JSON.parse(roda("on"));
  assert.equal(ligada.resposta, TEXTO_PRE_ACEITE);
  assert.deepEqual(ligada.temas, ["morador", "contratos"]);
  assert.deepEqual(JSON.parse(roda("off")), { resposta: null, temas: [] });
  assert.deepEqual(regrasPublicas(false).map((r) => r.id), ["documento-na-mensagem", "prazos-da-viva"]);
  assert.deepEqual(regrasPublicas(true).map((r) => r.id), ["pre-aceite", "documento-na-mensagem", "prazos-da-viva"]);
});

test("E957 — os artigos do contato protegido (Morador e Segurança) declaram a recusa de CPF/RG com aviso", () => {
  assert.match(TEXTO_DOCUMENTO_NA_MENSAGEM, /CPF ou RG é recusada com um aviso/);
  assert.ok(resposta("contato").includes(TEXTO_DOCUMENTO_NA_MENSAGEM), resposta("contato"));
  assert.ok(doTema("morador").includes("contato") && doTema("seguranca").includes("contato"));
});

test("E958 (metade E948) — os prazos da Viva saem de PRAZO_CANAL e estão nos temas Morador, Contratos e Segurança", () => {
  assert.ok(TEXTO_PRAZOS_DA_VIVA.includes(`até ${PRAZO_CANAL.suporte.texto}`));
  assert.ok(TEXTO_PRAZOS_DA_VIVA.includes(`até ${PRAZO_CANAL.documento.texto}`));
  assert.equal(resposta("prazos-da-viva"), TEXTO_PRAZOS_DA_VIVA);
  for (const t of ["morador", "contratos", "seguranca"]) assert.ok(doTema(t).includes("prazos-da-viva"), t);
});

test("E956/E957/E958 — /como-funciona e a home mostram as regras pela mesma fonte, com a chave", () => {
  for (const pagina of ["app/(public)/como-funciona/page.tsx", "app/(public)/page.tsx"]) {
    const src = ler(pagina);
    assert.match(src, /<RegrasPublicas\b/, pagina);
  }
  const comp = ler("components/institucional/regras-publicas.tsx");
  assert.match(comp, /regrasPublicas\(PRE_ACEITACAO_72H_ATIVA\)/);
  assert.match(comp, /data-testid="regras-publicas"/);
});
