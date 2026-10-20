import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { gerarPdf } from "./fiscal/pdf.ts";
import { conteudoPacoteProvas } from "./contrato-provas.ts";
import { hashResumo } from "./contrato-assinar.ts";

const rota = readFileSync("src/app/api/contrato/[id]/provas/route.ts", "utf8");
const carga = readFileSync("src/lib/data/contrato-provas.ts", "utf8");
const detalhe = readFileSync("src/components/contrato/contrato-detalhe.tsx", "utf8");

test("rota: exige sessão (401), esconde quem não é parte (404) e não guarda em cache", () => {
  assert.match(rota, /auth\.getUser\(\)/);
  assert.match(rota, /status: 401/);
  assert.match(rota, /status: 404/);
  assert.match(rota, /private, no-store/);
  assert.match(rota, /attachment/);
});

test("carga: lê com a sessão da pessoa (RLS), nunca com o service role", () => {
  assert.doesNotMatch(carga, /createAdminClient|service_role/);
  assert.match(carga, /getContratoParaAssinar/);
  assert.doesNotMatch(carga, /\bip\b/);
});

test("tela do contrato oferece o botão de baixar o pacote", () => {
  assert.match(detalhe, /\/api\/contrato\/\$\{c\.id\}\/provas/);
  assert.match(detalhe, /data-testid="baixar-provas"/);
});

test("PDF do pacote é um PDF de verdade com a marca de minuta", async () => {
  const resumo = ["MINUTA DE TESTE — sem validade", "Contrato x"];
  const pdf = await gerarPdf(
    conteudoPacoteProvas({
      contratoId: "11111111-2222-3333-4444-555555555555",
      imovel: "Studio",
      status: "ativo",
      registradoEm: "2026-10-01T12:00:00Z",
      resumo,
      assinaturas: [{ papel: "inquilino", em: "2026-10-03T15:30:00Z", hash: hashResumo(resumo) }],
      pagamentos: [],
      conferencias: [],
    }),
  );
  assert.equal(Buffer.from(pdf.slice(0, 5)).toString(), "%PDF-");
  const lido = await PDFDocument.load(pdf);
  assert.equal(lido.getTitle(), "Pacote de provas do contrato");
  assert.ok(lido.getPageCount() >= 1);
});
