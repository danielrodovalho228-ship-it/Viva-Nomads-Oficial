/*
  E766 — o /admin mostra o estado SAUDÁVEL do backup (última cópia OK, último teste de restauração OK), não só o alerta
  de falha; /admin/backup e /admin/backups levam ao cartão completo (Sistema). Roda: node --test src/lib/backup/e766-resumo-admin.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estadoBackup, type LinhaBackup } from "./cartao.ts";

const l = (p: Partial<LinhaBackup>): LinhaBackup => ({ tipo: "copia", inicio: "2026-11-08T06:15:00Z", fim: "2026-11-08T06:20:00Z", ok: true, motivo: null, bytes_banco: 1, objetos_storage: 1, bytes_storage: 1, duracao_restauracao_s: null, bytes_pasta: null, ...p });
const agora = new Date("2026-11-08T12:00:00Z");

test("saudável: a última cópia OK e o último teste OK existem e o estado não é vermelho", () => {
  const e = estadoBackup([l({}), l({ tipo: "drill", inicio: "2026-11-08T09:00:00Z", fim: "2026-11-08T09:06:00Z", duracao_restauracao_s: 250 })], agora);
  assert.equal(e.vermelho, false);
  assert.ok(e.copia.ultimaOk && e.drill.ultimaOk);
});

test("falha: a cópia que falhou deixa o resumo vermelho com o porquê", () => {
  const e = estadoBackup([l({ ok: false, motivo: "falha na etapa: banco" }), l({ tipo: "drill", inicio: "2026-11-08T09:00:00Z", fim: "2026-11-08T09:06:00Z" })], agora);
  assert.equal(e.vermelho, true);
  assert.ok(e.copia.porque);
});

test("a inicial do /admin traz o resumo (sem o observador da QA) e as rotas antigas redirecionam", () => {
  const pagina = readFileSync("src/app/(dashboard)/admin/page.tsx", "utf8");
  assert.match(pagina, /import \{ ResumoBackup \}/);
  assert.match(pagina, /\{admin && !observador \? <ResumoBackup agora=\{agora\} \/> : null\}/);
  const resumo = readFileSync("src/components/admin/resumo-backup.tsx", "utf8");
  assert.match(resumo, /Última cópia OK em/);
  assert.match(resumo, /Último teste de restauração OK em/);
  assert.match(resumo, /href="\/admin\/sistema#backup"/);
  const cfg = readFileSync("next.config.ts", "utf8");
  assert.match(cfg, /source: "\/admin\/backup", destination: "\/admin\/sistema#backup"/);
  assert.match(cfg, /source: "\/admin\/backups", destination: "\/admin\/sistema#backup"/);
});
