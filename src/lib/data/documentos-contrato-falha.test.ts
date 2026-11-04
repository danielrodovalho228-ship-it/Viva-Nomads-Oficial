/*
  Estados vazios (documentos e caução do contrato): documentosDosContratos ignorava o erro das quatro leituras
  (documentos, acerto da caução, caução confirmada e pagamentos confirmados). Na falha, o contrato aparecia sem
  documentos nem recibos e com caução 0 — e, no contrato encerrado, o dono via o formulário "Registrar devolução"
  como se a devolução nunca tivesse sido registrada (acerto lido como null), podendo registrar outra.
  Agora qualquer erro marca `falhou` no contrato: a tela mostra o aviso para recarregar e NÃO mostra o formulário
  da devolução, a resposta do morador nem a lista de documentos.
  Roda: node --test src/lib/data/documentos-contrato-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync("src/lib/data/documentos-actions.ts", "utf8");
const fn = s.slice(s.indexOf("export async function documentosDosContratos"), s.indexOf("/** Contrato + papel da pessoa"));
const contratos = readFileSync("src/app/(dashboard)/dashboard/contratos/contratos-client.tsx", "utf8");
const locacoes = readFileSync("src/app/(dashboard)/dashboard/locacoes/locacoes-client.tsx", "utf8");
const comp = readFileSync("src/components/documentos/documentos-contrato.tsx", "utf8");

test("as quatro leituras conferem o erro e a falha marca o contrato", () => {
  assert.match(fn, /\{ data: docs, error: eDocs \}, \{ data: acertos, error: eAcertos \}, \{ data: caucoes, error: eCaucoes \}, \{ data: confirmados, error: eConfirmados \}/);
  assert.match(fn, /if \(eDocs \|\| eAcertos \|\| eCaucoes \|\| eConfirmados\) \{/);
  assert.match(fn, /falhou: true/);
  assert.ok(fn.indexOf("if (eDocs ||") < fn.indexOf("const docDoPagamento"), "confere antes de montar a lista");
});

test("o aviso existe e pede para recarregar (não diz 'nenhum documento')", () => {
  assert.match(comp, /export const MSG_DOCUMENTOS_NAO_CARREGARAM =/);
  assert.match(comp, /export function AvisoDocumentosFalhou\(/);
  assert.match(comp, /data-testid="documentos-falhou"/);
});

test("Contratos (dono): na falha, aviso no lugar da devolução e da lista", () => {
  assert.match(contratos, /extra\.falhou \? \(\s*<AvisoDocumentosFalhou \/>/);
});

test("Locações (morador): na falha, aviso no lugar da resposta da devolução e da lista", () => {
  assert.match(locacoes, /extras\[l\.id\]\?\.falhou \? \(\s*<AvisoDocumentosFalhou \/>/);
});
