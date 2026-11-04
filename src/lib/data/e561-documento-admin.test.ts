/*
  E561 — admin × dono divergiam sobre o documento do MESMO rascunho (4a693a63, proprietario2): o admin mostrava
  "documento: Recusado" (a 1ª linha que o banco devolvia, sem ordem — a recusa antiga de 20/10) e o dono via o
  documento aprovado (o vigente, statusPorImovel). Agora o admin lê o MESMO estado vigente, das linhas da mais recente
  para a mais antiga; o filtro "documento em revisão" segue achando o envio pendente por um campo próprio.
  Roda: node --test src/lib/data/e561-documento-admin.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { statusPorImovel } from "../documento/vigente.ts";

const f = readFileSync("src/lib/data/admin-indicadores.ts", "utf8");
const fn = f.slice(f.indexOf("export async function imoveisDoBanco("), f.indexOf("export async function imoveisDoBanco(") + 2600);
const pg = readFileSync("src/app/(dashboard)/admin/imoveis/page.tsx", "utf8");

test("o caso do 4a693a63: recusa antiga + aprovado novo → o vigente é aprovado (o que o dono vê)", () => {
  const linhas = [
    { property_id: "4a693a63", document_status: "approved", created_at: "2026-11-04T20:52:22Z" },
    { property_id: "4a693a63", document_status: "rejected", created_at: "2026-10-20T01:47:29Z" },
  ];
  assert.equal(statusPorImovel(linhas).get("4a693a63"), "approved");
});

test("admin: lê as linhas da mais recente para a mais antiga e usa statusPorImovel (a fonte do dono)", () => {
  assert.match(fn, /\.select\("property_id, document_status, created_at"\)\.in\("property_id", ids\)\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(fn, /const vigente = statusPorImovel\(/);
  assert.match(fn, /documento: vigente\.get\(p\.id\) \?\? "none",/);
  assert.match(fn, /documentoEmRevisao: emRevisao\.has\(p\.id\),/);
  assert.doesNotMatch(fn, /if \(!atual \|\| d\.document_status === "pending"\)/);
});

test("a tela: o filtro 'documento em revisão' usa o campo próprio; a linha mostra o vigente", () => {
  assert.match(pg, /\(!docRevisao \|\| i\.documentoEmRevisao\)/);
  assert.match(pg, /documento: \{DOC\[i\.documento\] \?\? i\.documento\}/);
});
