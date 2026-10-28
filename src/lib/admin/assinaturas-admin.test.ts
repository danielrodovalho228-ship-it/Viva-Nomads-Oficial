/*
  E197 — o detalhe do contrato no admin não diz "Nenhuma assinatura ainda" quando o contrato tem as duas datas.
  Roda: node --test src/lib/admin/assinaturas-admin.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEXTO_SEM_HASH, assinaturasDoAdmin } from "./assinaturas-admin.ts";

const cmp = { estado: "igual" as const, texto: "igual ao resumo atual" };
const ler = (rel: string) => readFileSync(new URL(`../../../${rel}`, import.meta.url), "utf8");

test("datas no contrato sem registro com hash (VN-CT-D5D50247): as duas assinaturas aparecem, sem hash", () => {
  const a = assinaturasDoAdmin([], { proprietario: "2026-09-30T15:00:00Z", inquilino: "2026-09-30T15:30:00Z" });
  assert.deepEqual(a.map((x) => [x.papel, x.em, x.hash]), [["proprietario", "2026-09-30T15:00:00Z", null], ["inquilino", "2026-09-30T15:30:00Z", null]]);
  assert.match(TEXTO_SEM_HASH, /Sem o registro do hash/);
});

test("o registro com hash vale; a data do contrato só completa o papel que falta", () => {
  const a = assinaturasDoAdmin([{ papel: "inquilino", em: "2026-10-02T10:00:00Z", hash: "abc", comparacao: cmp }], { proprietario: "2026-10-01T10:00:00Z", inquilino: "2026-10-02T10:00:00Z" });
  assert.deepEqual(a.map((x) => [x.papel, x.hash]), [["proprietario", null], ["inquilino", "abc"]]);
  assert.equal(assinaturasDoAdmin([], { proprietario: null, inquilino: null }).length, 0);
});

test("o detalhe usa as duas fontes; o pacote de provas segue só com os registros com hash", () => {
  const dados = ler("src/lib/data/contrato-admin.ts");
  assert.match(dados, /assinado_proprietario_em, assinado_inquilino_em/);
  assert.match(dados, /assinaturas: assinaturasDoAdmin\(/);
  assert.match(dados, /montarDadosProvas\(\{[\s\S]*assinaturas: ass \?\? \[\]/);
  const tela = ler("src/app/(dashboard)/admin/contratos/[id]/page.tsx");
  assert.match(tela, /data-testid="admin-assinatura-sem-hash"/);
});
