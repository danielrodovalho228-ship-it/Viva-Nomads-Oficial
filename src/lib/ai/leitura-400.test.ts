import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { classificarFalhaIa, extrairJson, instrucaoJsonNoPrompt, pedidoRecusadoPelaApi, resumoDoErro, ERRO_RESUMO_MAX } from "./falha-ia.ts";
import { LEITURA_OUTPUT_SCHEMA } from "../documento/conferencia.ts";
import { MATRICULA_OUTPUT_SCHEMA } from "../documento/conferencia-matricula.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

// Prompt 25: em produção (18/10) a leitura de documento voltava 400 invalid_request_error em < 0,6 s.
const erro400 = (msg: string) =>
  new Anthropic.BadRequestError(400, { type: "error", error: { type: "invalid_request_error", message: msg } }, `400 ${msg}`, new Headers());

test("p25 — a mensagem do 400 é guardada (até 300 caracteres) e o caso é 'pedido recusado'", () => {
  const f = classificarFalhaIa(erro400("output_config.format.schema: enum values must match the declared type"));
  assert.equal(f.status, 400);
  assert.equal(f.tipo, "invalid_request_error");
  assert.equal(f.resumo, "output_config.format.schema: enum values must match the declared type");
  assert.equal(pedidoRecusadoPelaApi(f), true);
  assert.ok((resumoDoErro(erro400("x".repeat(900))) ?? "").length === ERRO_RESUMO_MAX);
  // Arquivo grande não é "pedido recusado" (tem motivo próprio e não adianta repetir sem a saída estruturada).
  assert.equal(pedidoRecusadoPelaApi(classificarFalhaIa(erro400("image exceeds 5 MB maximum"))), false);
});

test("p25 — sem saída estruturada, o JSON vem do texto (com ou sem cerca ```)", () => {
  assert.deepEqual(extrairJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extrairJson('Aqui está: {"b": [1,2]} fim'), { b: [1, 2] });
  assert.throws(() => extrairJson("nada"), SyntaxError);
  assert.match(instrucaoJsonNoPrompt({ type: "object" }), /SOMENTE com um objeto JSON/);
});

/** Palavras do JSON Schema que a saída estruturada não aceita, e `enum` com null (o suspeito do 400). */
function problemasDoSchema(no: unknown, caminho = "$"): string[] {
  if (!no || typeof no !== "object") return [];
  if (Array.isArray(no)) return no.flatMap((x, i) => problemasDoSchema(x, `${caminho}[${i}]`));
  const o = no as Record<string, unknown>;
  const out: string[] = [];
  for (const k of ["pattern", "minLength", "maxLength", "minimum", "maximum", "oneOf", "format"]) if (k in o) out.push(`${caminho}.${k}`);
  if (Array.isArray(o.enum) && o.enum.includes(null)) out.push(`${caminho}.enum com null`);
  if (o.type === "object" && o.additionalProperties !== false) out.push(`${caminho}: falta additionalProperties:false`);
  if (o.type === "object" && o.properties) {
    const req = new Set((o.required as string[]) ?? []);
    for (const p of Object.keys(o.properties as object)) if (!req.has(p)) out.push(`${caminho}.${p} fora de required`);
  }
  for (const [k, v] of Object.entries(o)) out.push(...problemasDoSchema(v, `${caminho}.${k}`));
  return out;
}

test("p25 — os dois schemas de leitura só usam o que a saída estruturada aceita", () => {
  assert.deepEqual(problemasDoSchema(LEITURA_OUTPUT_SCHEMA), []);
  assert.deepEqual(problemasDoSchema(MATRICULA_OUTPUT_SCHEMA), []);
});

test("p25 — documento e matrícula: mesmo caminho, erro gravado e 2ª tentativa sem a saída estruturada", () => {
  const c = ler("../documento/conferidor.ts");
  assert.equal((c.match(/parametrosLeitura\(a, estruturado/g) ?? []).length, 2);
  assert.match(c, /erroResumo: falha\.resumo/);
  assert.match(c, /pedidoRecusadoPelaApi\(primeira\.falha\)\) return tentar\(false\)/);
  const reg = ler("./registro-ia.ts");
  assert.match(reg, /erro_resumo:/);
});

test("p25 — identidade: laudos já gravados passam a 12 meses (só os que ainda valem) e trocar nome/CPF pede 'Confirmar de novo'", () => {
  const sql = ler("../../../supabase/producao/aplicar-0167.sql");
  assert.match(sql, /set valid_until = created_at \+ interval '12 months'/);
  assert.match(sql, /valid_until < created_at \+ interval '12 months'/);
  assert.match(sql, /valid_until > now\(\)/);
  assert.match(sql, /^begin;/m);
  assert.match(sql, /schema_migrations/);
  const status = ler("../../app/api/caf/status/route.ts");
  assert.match(status, /refazer: !r\.feita && !!laudo/);
  const etapa = ler("../../components/anuncio/etapa-identidade.tsx");
  assert.match(etapa, /Confirmar de novo/);
});
