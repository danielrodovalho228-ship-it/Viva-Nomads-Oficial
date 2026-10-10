/* Roda: node --test src/lib/agentes/anexos.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { adminPodeAbrir, caminhoAnexo, nomeExibicao, TAMANHO_MAXIMO_ANEXO, validarAnexo } from "./anexos.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

test("aceita imagem, pdf, planilha, docx e áudio", () => {
  for (const m of ["image/png", "application/pdf", "text/csv", "audio/mpeg", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]) {
    assert.equal(validarAnexo(m, 1000).ok, true, m);
  }
});

test("recusa tipo perigoso ou desconhecido", () => {
  for (const m of ["text/html", "image/svg+xml", "application/x-msdownload", "application/zip", ""]) {
    assert.equal(validarAnexo(m, 1000).ok, false, m);
  }
});

test("limite de 20 MB e arquivo vazio", () => {
  assert.equal(validarAnexo("application/pdf", TAMANHO_MAXIMO_ANEXO).ok, true);
  assert.equal(validarAnexo("application/pdf", TAMANHO_MAXIMO_ANEXO + 1).ok, false);
  assert.equal(validarAnexo("application/pdf", 0).ok, false);
  assert.equal(validarAnexo("application/pdf", Number.NaN).ok, false);
});

test("mime com parâmetro e maiúsculas", () => {
  assert.equal(validarAnexo("Audio/WebM; codecs=opus", 10).ok, true);
});

test("caminho só com ids e extensão fixa", () => {
  assert.equal(caminhoAnexo(A, B, "pdf"), `${A}/${B}.pdf`);
  assert.equal(caminhoAnexo("../x", B, "pdf"), null);
  assert.equal(caminhoAnexo(A, B, "../x"), null);
});

test("nome de exibição sem pasta nem controle", () => {
  assert.equal(nomeExibicao("C:\\fotos\\a.png"), "a.png");
  assert.equal(nomeExibicao("../../etc/passwd"), "passwd");
  assert.equal(nomeExibicao("<b>x</b>\n.pdf"), "b.pdf");
  assert.equal(nomeExibicao(""), "arquivo");
  assert.equal(nomeExibicao("a".repeat(200)).length, 80);
});

test("admin não abre anexo de outro admin nem com ..", () => {
  assert.equal(adminPodeAbrir(A, `${A}/${B}.pdf`), true);
  assert.equal(adminPodeAbrir(A, `${B}/${B}.pdf`), false);
  assert.equal(adminPodeAbrir(A, `${A}/../${B}/x.pdf`), false);
  assert.equal(adminPodeAbrir("nao-uuid", "nao-uuid/x.pdf"), false);
});
