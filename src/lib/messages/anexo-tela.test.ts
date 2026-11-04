/** E445 item 5 (tela) — anexar foto/PDF na conversa e a prévia — `npm test`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ACEITA_ANEXO, ROTA_ENVIAR_ANEXO, anexoDaMensagem, podeAnexar, tipoNaTela, urlDoAnexo, validarAnexoNaTela } from "./anexo-tela.ts";
import { ANEXO_MAX_BYTES, corpoDoAnexo } from "./anexos.ts";

test("o seletor aceita só foto (JPG, PNG, WebP) e PDF", () => {
  assert.equal(ACEITA_ANEXO, "image/jpeg,image/png,image/webp,application/pdf");
});

test("validação antes de enviar: vazio, grande demais, tipo fora — com a MESMA mensagem do servidor", () => {
  assert.equal(validarAnexoNaTela({ size: 0, type: "image/png" }), "O arquivo está vazio.");
  assert.equal(validarAnexoNaTela({ size: ANEXO_MAX_BYTES + 1, type: "image/png" }), "Arquivo grande demais (máx. 10 MB).");
  assert.equal(validarAnexoNaTela({ size: 100, type: "image/svg+xml" }), "Envie uma foto (JPG, PNG ou WebP) ou um PDF.");
  assert.equal(validarAnexoNaTela({ size: 100, type: "text/plain" }), "Envie uma foto (JPG, PNG ou WebP) ou um PDF.");
  assert.equal(validarAnexoNaTela({ size: ANEXO_MAX_BYTES, type: "application/pdf" }), null);
  assert.equal(validarAnexoNaTela({ size: 2048, type: "image/jpeg" }), null);
});

test("tipo na tela: foto ou PDF", () => {
  assert.equal(tipoNaTela("image/jpeg"), "foto");
  assert.equal(tipoNaTela("image/webp"), "foto");
  assert.equal(tipoNaTela("application/pdf"), "pdf");
  assert.equal(tipoNaTela("text/html"), null);
});

test("link do anexo: só pela rota do servidor (URL assinada, nunca pública)", () => {
  const id = "0b7f0b6e-2a3c-4d5e-8f90-1a2b3c4d5e6f";
  assert.equal(urlDoAnexo(id), `/api/mensagens/anexo/${id}`);
  assert.equal(ROTA_ENVIAR_ANEXO, "/api/mensagens/anexo");
  assert.throws(() => urlDoAnexo("../../segredo"));
});

test("quem pode anexar: conversa entre pessoas, fora da demonstração, do suporte e do pedido de parceiro", () => {
  const base = { otherId: "x", papel: "proprietario" as const };
  assert.equal(podeAnexar(base, false), true);
  assert.equal(podeAnexar(base, true), false);
  assert.equal(podeAnexar({ ...base, papel: "suporte" as const }, false), false);
  assert.equal(podeAnexar({ ...base, pedidoParceiroId: "p" }, false), false);
  assert.equal(podeAnexar({ papel: "morador" as const }, false), false);
});

test("anexo da mensagem: liga a linha de mensagens_anexos à bolha", () => {
  const linhas = [
    { id: "a1", message_id: "m1", mime: "image/png" },
    { id: "a2", message_id: "m2", mime: "application/pdf" },
    { id: "a3", message_id: "m3", mime: "text/plain" },
  ];
  const mapa = anexoDaMensagem(linhas);
  assert.deepEqual(mapa.get("m1"), { id: "a1", tipo: "foto" });
  assert.deepEqual(mapa.get("m2"), { id: "a2", tipo: "pdf" });
  assert.equal(mapa.has("m3"), false);
  // O texto da mensagem é o do servidor (sem o nome do arquivo).
  assert.equal(corpoDoAnexo("image/png"), "Anexo: foto enviada");
});
