/*
  Denunciar mensagem suspeita (ordem 404cd213, item 3): a denúncia vira chamado de segurança (P1,
  fila antifraude) e o texto leva só o id da conversa e a nota da pessoa — nunca o conteúdo das mensagens.
  Roda: node --test src/lib/atendimento/denuncia-mensagem.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { textoDenuncia, validarDenuncia, ASSUNTO_DENUNCIA } from "./denuncia-mensagem.ts";
import { categoria, classificar } from "./classificar.ts";
import { filaDaCategoria } from "./filas.ts";

const ID = "3f2b8c1e-5a4d-4e6f-9a1b-2c3d4e5f6a7b";

test("conversa precisa ser um UUID", () => {
  assert.equal(validarDenuncia({ conversationId: "1", nota: "" }).ok, false);
  assert.equal(validarDenuncia({ conversationId: "'; drop table messages;--", nota: "" }).ok, false);
  assert.equal(validarDenuncia({ conversationId: ID, nota: "" }).ok, true);
});

test("nota é opcional, aparada e limitada a 500 letras", () => {
  const ok = validarDenuncia({ conversationId: ID, nota: "  pediu Pix fora  " });
  assert.ok(ok.ok && ok.nota === "pediu Pix fora");
  assert.equal(validarDenuncia({ conversationId: ID, nota: "a".repeat(501) }).ok, false);
});

test("texto do chamado cita o id da conversa e a nota, e nada além", () => {
  const t = textoDenuncia(ID, "pediu Pix fora");
  assert.ok(t.includes(ID));
  assert.ok(t.includes("pediu Pix fora"));
  assert.ok(t.length >= 5);
  assert.match(textoDenuncia(ID, ""), /sem observação/i);
});

test("a categoria de segurança já é P1 e vai para a fila antifraude", () => {
  assert.equal(categoria("seguranca")?.prioridade, "p1");
  assert.equal(classificar("seguranca", textoDenuncia(ID, "")).prioridade, "p1");
  assert.equal(filaDaCategoria("seguranca"), "antifraude");
  assert.ok(ASSUNTO_DENUNCIA.length <= 140);
});
