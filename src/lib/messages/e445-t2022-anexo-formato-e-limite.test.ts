/*
  t2022 · E445 (Pista 3, lote 2, item B2) @E445 @ao-vivo-seguro
  Regra: o anexo da conversa aceita os tipos de ACEITA_ANEXO (foto JPG/PNG/WebP e PDF — o PDF é ACEITO) e recusa o resto
  e o que passa de 10 MB, com a MESMA mensagem na tela e no servidor. O servidor decide pelo tipo REAL (primeiros bytes),
  nunca pelo nome nem pelo Content-Type declarado; recusado, nada é gravado (nem mensagem, nem arquivo).
  Roda o POST REAL de src/app/api/mensagens/anexo/route.ts (dublês só nas bordas, ver conversa-harness/).
  Roda: node --test src/lib/messages/e445-t2022-anexo-formato-e-limite.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { U, novoMundo } from "./conversa-harness/supabase-falso.ts";
import { ACEITA_ANEXO, validarAnexoNaTela } from "./anexo-tela.ts";
// O limite decidido é 10 MB: escrito aqui, não importado — se a constante mudar, o teste acusa.
const ANEXO_MAX_BYTES = 10 * 1024 * 1024;

const { POST } = await import("../../app/api/mensagens/anexo/route.ts");

const BYTES = {
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37],
  jpg: [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0],
  webp: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
  svg: [...new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
  gif: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  exe: [0x4d, 0x5a, 0x90, 0x00],
};
const MSG_TIPO = "Envie uma foto (JPG, PNG ou WebP) ou um PDF.";
const MSG_GRANDE = "Arquivo grande demais (máx. 10 MB).";

async function enviar(arquivo: File) {
  const mundo = novoMundo({ messages: [], mensagens_anexos: [] }, U.morador);
  const form = new FormData();
  form.set("receiverId", U.dono);
  form.set("propertyId", U.imovel);
  form.set("file", arquivo);
  const r = await POST(new Request("http://teste.invalid/api/mensagens/anexo", { method: "POST", body: form }));
  return { status: r.status, corpo: (await r.json()) as { ok?: boolean; error?: string; mime?: string }, ...mundo };
}

test("B2: PDF, JPG, PNG e WebP são aceitos — gravam a mensagem, o arquivo com o tipo real e o registro do anexo", async () => {
  for (const [nome, mime, corpoMsg] of [["pdf", "application/pdf", "Anexo: PDF enviado"], ["jpg", "image/jpeg", "Anexo: foto enviada"], ["png", "image/png", "Anexo: foto enviada"], ["webp", "image/webp", "Anexo: foto enviada"]] as const) {
    assert.ok(ACEITA_ANEXO.split(",").includes(mime), `${mime} está no seletor (ACEITA_ANEXO)`);
    const r = await enviar(new File([new Uint8Array(BYTES[nome])], `x.${nome}`, { type: mime }));
    assert.equal(r.status, 200, `${nome}: ${JSON.stringify(r.corpo)}`);
    assert.deepEqual([r.corpo.ok, r.corpo.mime], [true, mime]);
    assert.equal(r.tabelas.messages.length, 1);
    assert.equal(r.tabelas.messages[0].body, corpoMsg);
    assert.equal(r.tabelas.mensagens_anexos.length, 1);
    assert.equal(r.tabelas.mensagens_anexos[0].mime, mime);
    assert.equal([...r.registro.arquivos.values()][0].contentType, mime);
  }
});

test("B2: tipo fora (SVG, GIF, executável) é recusado com a mensagem da tela — mesmo disfarçado de .jpg — e nada é gravado", async () => {
  for (const nome of ["svg", "gif", "exe"] as const) {
    const disfarce = new File([new Uint8Array(BYTES[nome])], "foto.jpg", { type: "image/jpeg" });
    const r = await enviar(disfarce);
    assert.equal(r.status, 415, nome);
    assert.equal(r.corpo.error, MSG_TIPO, nome);
    assert.equal(r.tabelas.messages.length + r.tabelas.mensagens_anexos.length + r.registro.arquivos.size, 0, `${nome}: nada gravado`);
  }
  // A tela recusa o tipo declarado fora da lista com o MESMO texto.
  assert.equal(validarAnexoNaTela({ size: 100, type: "image/gif" }), MSG_TIPO);
  assert.equal(validarAnexoNaTela({ size: 100, type: "audio/ogg" }), MSG_TIPO);
});

test("B2: acima de 10 MB é recusado (413) antes de ler o arquivo e de gastar o limite do dia; 10 MB exatos passam", async () => {
  const grande = new Uint8Array(ANEXO_MAX_BYTES + 1);
  grande.set(BYTES.pdf);
  const r = await enviar(new File([grande], "contrato.pdf", { type: "application/pdf" }));
  assert.equal(r.status, 413);
  assert.equal(r.corpo.error, MSG_GRANDE);
  assert.deepEqual(r.estado.limites, [], "o limite de envios do dia não foi consumido");
  assert.equal(r.tabelas.messages.length, 0);
  assert.equal(validarAnexoNaTela({ size: ANEXO_MAX_BYTES + 1, type: "application/pdf" }), MSG_GRANDE);

  const noLimite = new Uint8Array(ANEXO_MAX_BYTES);
  noLimite.set(BYTES.pdf);
  const ok = await enviar(new File([noLimite], "contrato.pdf", { type: "application/pdf" }));
  assert.equal(ok.status, 200);
  assert.equal(validarAnexoNaTela({ size: ANEXO_MAX_BYTES, type: "application/pdf" }), null);
});

test("B2: arquivo vazio é recusado com 'O arquivo está vazio.'", async () => {
  const r = await enviar(new File([], "vazio.pdf", { type: "application/pdf" }));
  assert.equal(r.status, 400);
  assert.equal(r.corpo.error, "O arquivo está vazio.");
  assert.equal(validarAnexoNaTela({ size: 0, type: "application/pdf" }), "O arquivo está vazio.");
});
