/*
  E766 (reprova da prova ao vivo de 11/11): "nenhuma exibição de backup no admin em produção" — /admin sem resumo e
  /admin/sistema#backup vazio, sem a palavra "backup". Causa: a conta da prova é o admin OBSERVADOR da QA, e o resumo e o
  cartão eram escondidos dele. O observador passa a ver o RESUMO de estado (datas, "Em dia"/"Atenção", o porquê) — só
  leitura e sem dado de usuário; o cartão completo (tamanhos, pasta do Drive, guia de restauração) segue só para o admin.
  Roda: node --test src/lib/backup/e766-observador-ve-backup.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const inicial = readFileSync("src/app/(dashboard)/admin/page.tsx", "utf8");
const sistema = readFileSync("src/app/(dashboard)/admin/sistema/page.tsx", "utf8");
const resumo = readFileSync("src/components/admin/resumo-backup.tsx", "utf8");

test("/admin: o resumo do backup aparece para todo admin, inclusive o observador da QA", () => {
  assert.match(inicial, /\{admin \? <ResumoBackup agora=\{agora\} \/> : null\}/);
  assert.doesNotMatch(inicial, /!observador \? <ResumoBackup/);
});

test("/admin/sistema#backup nunca fica vazio: o observador vê o resumo; o cartão completo segue só para o admin", () => {
  const ancora = sistema.slice(sistema.indexOf('<div id="backup"'), sistema.indexOf('<div id="entrada-email"'));
  assert.match(ancora, /\{observador \? <ResumoBackup semDetalhe \/> : null\}/);
  assert.match(ancora, /\{observador \? null : <CartaoBackup \/>\}/);
  assert.match(sistema, /import \{ ResumoBackup \} from "@\/components\/admin\/resumo-backup";/);
});

test("o resumo é só leitura e sem detalhe sensível: sem tamanhos, pasta do Drive nem guia de restauração; 'Ver detalhes' opcional", () => {
  assert.match(resumo, /semDetalhe/);
  assert.match(resumo, /\{semDetalhe \? null : \(/);
  assert.doesNotMatch(resumo, /bytes_banco|bytesPasta|LINK_RESTAURACAO|<form|<button/);
  assert.match(resumo, /title="Backup"/);
});
