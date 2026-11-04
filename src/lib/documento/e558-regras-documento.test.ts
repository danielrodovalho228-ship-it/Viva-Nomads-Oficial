/** E558 — as regras do documento do imóvel aparecem ANTES do envio, junto do campo — `npm test`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REGRAS_ENVIO_DOCUMENTO, FORMATOS_ACEITOS_TEXTO } from "./conferencia.ts";
import { DOC_MIN_BYTES } from "../upload-limits.ts";

test("as 4 regras que o dono descobria por tentativa (duplicidade, tamanho mínimo, tipos, conferência manual)", () => {
  const t = REGRAS_ENVIO_DOCUMENTO.join("\n");
  assert.equal(REGRAS_ENVIO_DOCUMENTO.length, 4);
  assert.match(t, /Um arquivo por imóvel: arquivo já usado em outro cadastro é recusado\./);
  assert.match(t, /Tamanho mínimo de 10 KB\./);
  assert.ok(REGRAS_ENVIO_DOCUMENTO.includes(FORMATOS_ACEITOS_TEXTO), "tipos aceitos: o mesmo texto de sempre");
  assert.match(t, /conferência manual em até 48 horas/);
});

test("o mínimo do texto é o MESMO piso que o servidor aplica (/api/upload/documento)", () => {
  assert.equal(DOC_MIN_BYTES, 10 * 1024);
  assert.match(REGRAS_ENVIO_DOCUMENTO[1], new RegExp(`${DOC_MIN_BYTES / 1024} KB`));
});

test("o campo do documento mostra as regras ANTES do botão de envio (computador e celular: mesmo bloco)", () => {
  const src = readFileSync(new URL("../../components/anuncio/documento-vinculo.tsx", import.meta.url), "utf8");
  const regras = src.indexOf('data-testid="documento-regras"');
  const botao = src.indexOf('data-testid="documento-enviar"');
  assert.ok(regras > 0, "bloco de regras no campo");
  assert.ok(regras < botao, "as regras vêm antes do botão de envio");
  assert.match(src, /REGRAS_ENVIO_DOCUMENTO\.map/);
  // Sem classe que esconda no celular ou no computador.
  const bloco = src.slice(src.lastIndexOf("<", regras), regras);
  assert.doesNotMatch(bloco, /\b(hidden|sm:hidden|lg:hidden|md:hidden)\b/);
});
