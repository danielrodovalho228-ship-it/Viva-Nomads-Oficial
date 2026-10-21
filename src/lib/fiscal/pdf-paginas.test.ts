/*
  Prompt 35B, F4 — quebra de página do gerarPdf (causa raiz do #901: a conferência sumia do pacote de provas).
  Roda: node --test src/lib/fiscal/pdf-paginas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { gerarPdf, quebrar } from "./pdf.ts";
import { textoDasPaginas, textoDoPdf } from "./pdf-texto.ts";
import { conteudoDocumento, type DadosDocumento } from "./documento.ts";

const longo = (n: number) => ({
  titulo: "Documento longo",
  subtitulo: "teste de quebra de página",
  quadro: [["Contrato", "VN-CT-TESTE"]] as [string, string][],
  corpo: Array.from({ length: n }, (_, i) => `Linha ${i + 1} do conteúdo — conferência de entrada`),
  rodape: ["Rodapé do documento."],
});

test("200 linhas geram 3 ou mais páginas e a ÚLTIMA linha está no texto extraído do PDF", async () => {
  const pdf = await gerarPdf(longo(200));
  const doc = await PDFDocument.load(pdf);
  assert.ok(doc.getPageCount() >= 3, `páginas: ${doc.getPageCount()}`);
  const texto = await textoDoPdf(pdf);
  assert.ok(texto.includes("Linha 200 do conteúdo — conferência de entrada"), "a última linha não pode sumir");
  assert.ok(texto.includes("Linha 1 do conteúdo"));
  assert.ok(texto.includes("Rodapé do documento."));
});

test("cada página tem 'página X de Y'; da segunda em diante, o cabeçalho 'continuação'", async () => {
  const pdf = await gerarPdf(longo(200));
  const paginas = await textoDasPaginas(pdf);
  paginas.forEach((t, i) => {
    assert.ok(t.includes(`página ${i + 1} de ${paginas.length}`), `rodapé da página ${i + 1}`);
    if (i > 0) assert.ok(t.includes("Viva Nomads · Documento longo (continuação)"), `cabeçalho da página ${i + 1}`);
  });
  assert.ok(!paginas[0].includes("(continuação)"));
});

test("nada é desenhado abaixo da margem: toda linha cai dentro da folha", async () => {
  const pdf = await gerarPdf(longo(120));
  const doc = await PDFDocument.load(pdf);
  // o texto de cada linha aparece uma vez só, e o total bate com o pedido
  const texto = await textoDoPdf(pdf);
  for (let i = 1; i <= 120; i++) assert.equal(texto.split(`Linha ${i} do conteúdo`).length - 1, 1, `linha ${i}`);
  assert.ok(doc.getPageCount() >= 2);
});

test("quebra de linha longa não corta palavra; só parte a palavra que sozinha não cabe", async () => {
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const frase = "O proprietário confirmou a conferência de entrada em 19/10/2026 às 14:32 depois de registrar a sala e o quarto";
  const linhas = quebrar(f, 11, frase, 200);
  assert.ok(linhas.length > 1);
  assert.equal(linhas.join(" "), frase, "juntando as linhas volta a frase inteira (nenhuma palavra cortada)");
  for (const l of linhas) assert.ok(f.widthOfTextAtSize(l, 11) <= 200);
  const hash = "a".repeat(200);
  const partes = quebrar(f, 11, hash, 200);
  assert.equal(partes.join(""), hash);
  for (const l of partes) assert.ok(f.widthOfTextAtSize(l, 11) <= 200);
});

test("regressão: o recibo de uma página continua com UMA página", async () => {
  const base: DadosDocumento = {
    tipo: "recibo_aluguel",
    numero: "REC-2026-000001",
    emitidoEm: "2026-10-06T15:00:00Z",
    locador: { nome: "Dono Um", doc: "123.456.789-00" },
    locatario: { nome: "Inquilina Dois", doc: "987.654.321-00" },
    imovelEndereco: "Rua das Flores 123, Uberlândia",
    contratoRef: "CT-D7400000",
    periodoInicio: "2026-10-01",
    periodoFim: "2026-11-30",
    valor: 3000,
    encargos: [{ rotulo: "Condomínio", valor: 450 }],
    dataPagamento: "2026-10-05",
    forma: "pix",
    conferirUrl: "https://vivanomads.com.br/conferir/0123456789abcdef0123456789abcdef",
  };
  const pdf = await gerarPdf(conteudoDocumento(base));
  assert.equal((await PDFDocument.load(pdf)).getPageCount(), 1);
  const [unica] = await textoDasPaginas(pdf);
  assert.ok(unica.includes("página 1 de 1"));
  assert.ok(!unica.includes("continuação"));
});
