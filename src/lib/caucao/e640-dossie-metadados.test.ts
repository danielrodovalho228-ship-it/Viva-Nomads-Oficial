/*
  E640 (3), o que faltava: "metadados (hora/lugar) no servidor, exibidos no dossiê". O dossiê da caução (E637 b) mostrava as fotos de entrada × saída
  sem dizer QUANDO nem POR QUEM foram registradas. Agora cada foto leva uma legenda com dados do SERVIDOR (o EXIF do aparelho é removido no upload
  e nunca é confiado): a hora em que o arquivo chegou (created_at do Storage, em Brasília), quem enviou (a pasta do arquivo é o id de quem enviou) e o
  local (o imóvel do contrato; a posição do aparelho não é guardada).
  Roda: node --test src/lib/caucao/e640-dossie-metadados.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { legendaDaFoto, montarDossiePdf, type ItemDossie } from "./dossie.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("legendaDaFoto: hora do servidor em Brasília, quem enviou e o local", () => {
  const l = legendaDaFoto({ registradaEm: "2026-11-05T17:32:10Z", por: "Marcos Lima" }, "Apto Santa Mônica");
  assert.equal(l, "Registrada em 05/11/2026 14:32 (Brasília, hora do servidor) · enviada por Marcos Lima · Local: Apto Santa Mônica");
});

test("legendaDaFoto: dado ausente diz que não há, nunca inventa", () => {
  assert.equal(legendaDaFoto({ registradaEm: null, por: null }, "Apto"), "Hora de registro não disponível · autor não identificado · Local: Apto");
  assert.equal(legendaDaFoto(null, "Apto"), "Hora de registro não disponível · autor não identificado · Local: Apto");
  assert.match(legendaDaFoto({ registradaEm: "lixo", por: "Ana" }, "Apto"), /^Hora de registro não disponível · enviada por Ana/);
});

test("o PDF do dossiê sai com as legendas (e continua um PDF válido)", async () => {
  const item: ItemDossie & { fotoEntrada: Uint8Array | null; fotoSaida: Uint8Array | null; comprovante: string | null; metaEntrada: { registradaEm: string | null; por: string | null }; metaSaida: { registradaEm: string | null; por: string | null } } = {
    id: "1", categoria: "dano", comodo: "Sala", valor: 100, status: "proposto", contestacao: null,
    fotoEntrada: null, fotoSaida: null, comprovante: null,
    metaEntrada: { registradaEm: "2026-10-01T12:00:00Z", por: "Ana" }, metaSaida: { registradaEm: "2026-11-05T17:32:10Z", por: "Marcos" },
  };
  const pdf = await montarDossiePdf({ resumo: ["Dossiê da caução"], itens: [item], local: "Apto Santa Mônica" });
  assert.ok((await PDFDocument.load(pdf)).getPageCount() >= 2);
});

test("a rota lê a hora do servidor no Storage e quem enviou na pasta do arquivo (sem migração, sem confiar no EXIF)", () => {
  const r = ler("src/app/api/caucao/dossie/route.ts");
  assert.match(r, /metaEntrada/);
  assert.match(r, /metaSaida/);
  assert.match(r, /created_at/);
  assert.match(r, /storage\.from\("conferencia"\)\.list\(/);
  assert.match(r, /local: prop\.title/);
  // nada de ler posição ou EXIF do aparelho: a legenda usa só o que o servidor sabe
  assert.doesNotMatch(r, /\.exif|\.gps|latitude|longitude/i);
});
