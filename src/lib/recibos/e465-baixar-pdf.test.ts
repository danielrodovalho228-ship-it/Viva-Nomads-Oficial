/*
  E465 (PC9) — "Resumo anual (2026) em PDF" do parceiro: o clique não navegava, não mostrava nada e não deixava prova
  de download; o parceiro não sabia se o PDF foi gerado (era um <a> direto para um anexo; na falha, a resposta era um
  JSON que o navegador não mostrava). Correção: o clique GERA o PDF pela rota de sempre, mostra "Gerando o PDF…",
  baixa o arquivo com o nome que a rota dá e confirma "PDF gerado e baixado: <arquivo>". Falhou → a mensagem da rota
  (ou a frase padrão), sem baixar nada.
  Roda: node --test src/lib/recibos/e465-baixar-pdf.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG_PDF_FALHOU, MSG_PDF_GERANDO, msgPdfBaixado, nomeDoAnexo } from "./baixar-pdf.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("nome do arquivo vem do Content-Disposition da rota; sem ele, o nome padrão", () => {
  assert.equal(nomeDoAnexo('attachment; filename="resumo-servicos-2026.pdf"', "resumo.pdf"), "resumo-servicos-2026.pdf");
  assert.equal(nomeDoAnexo("attachment", "resumo.pdf"), "resumo.pdf");
  assert.equal(nomeDoAnexo(null, "resumo.pdf"), "resumo.pdf");
  assert.equal(nomeDoAnexo('attachment; filename="../../x.pdf"', "resumo.pdf"), "x.pdf", "sem caminho no nome");
});

test("as mensagens dizem o que aconteceu", () => {
  assert.match(MSG_PDF_GERANDO, /Gerando o PDF/);
  assert.equal(msgPdfBaixado("resumo-servicos-2026.pdf"), "PDF gerado e baixado: resumo-servicos-2026.pdf.");
  assert.match(MSG_PDF_FALHOU, /Tente de novo/);
});

test("o bloco do parceiro usa o botão que gera, baixa e avisa (não mais o <a> mudo)", () => {
  const bloco = ler("components/recibos/blocos-recibos.tsx");
  const parceiro = bloco.slice(bloco.indexOf("export async function BlocoRecibosParceiro"));
  assert.match(parceiro, /<BaixarPdf\s[^>]*href=\{`\/api\/recibos\/parceiro\?ano=\$\{ano\}`\}/);
  assert.match(parceiro, /testId="parceiro-resumo-anual"/);
  assert.doesNotMatch(parceiro, /<a key=\{ano\} href=\{`\/api\/recibos\/parceiro/);

  const botao = ler("components/recibos/baixar-pdf.tsx");
  assert.match(botao, /^"use client";/);
  assert.match(botao, /await fetch\(href/);
  assert.match(botao, /application\/pdf/);
  assert.match(botao, /URL\.createObjectURL\(blob\)/);
  assert.match(botao, /role="status"/);
  assert.match(botao, /aria-busy=\{estado\.tipo === "gerando"\}/);
  assert.match(botao, /disabled=\{estado\.tipo === "gerando"\}/);
});
