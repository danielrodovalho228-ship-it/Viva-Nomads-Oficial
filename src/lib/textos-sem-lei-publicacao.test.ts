import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DOC_AUTORIZACAO } from "./anuncio/operacao.ts";

const ler = (rel: string) => readFileSync(join(process.cwd(), "src", rel), "utf8");

test("publicar imóvel: o texto da tela não cita lei nem artigo (regra de 12/10, opção A)", () => {
  const dir = "app/(dashboard)/dashboard/imoveis/novo";
  const tela = ["page.tsx", "etapa-onde-fica.tsx", "etapa-preco.tsx", "etapa-revisar.tsx"].map((f) => ler(`${dir}/${f}`)).join("\n");
  assert.doesNotMatch(tela, /8\.245/);
  assert.doesNotMatch(tela, /art\. ?38/);
  assert.match(tela, /conta poupança, como manda a lei/);
});

test("aviso da sublocação: pede a autorização escrita sem citar lei", () => {
  const avisos = JSON.stringify(DOC_AUTORIZACAO);
  assert.doesNotMatch(avisos, /8\.245|art\./);
  assert.match(avisos, /autorização escrita do proprietário/);
});
