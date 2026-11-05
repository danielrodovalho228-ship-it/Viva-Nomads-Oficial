/*
  E543 (reprova de 05/11, "três estados incompatíveis"): o contrato da massa 0268 que terminou em 30/10 aparecia no
  admin com o selo "Encerrado em 30/10/2026" (fonte única), mas o filtro "Situação" da lista lia o status cru do banco
  ("ativo") — filtrar "Ativo" trazia um contrato que a própria linha dizia encerrado, e o bloco dele está "encerrado".
  Correção: a lista do admin filtra e rotula pela MESMA fonte do selo (situacaoParaEquipe ← estadoDoContratoUnico).
  Roda: node --test src/lib/e543-situacao-admin.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { situacaoParaEquipe, seloParaEquipe, ROTULO_SITUACAO_EQUIPE } from "./contrato-estado.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const AGORA = new Date("2026-11-05T15:00:00Z");
const ASSINADO = { assinado_proprietario_em: "2026-09-20T12:00:00Z", assinado_inquilino_em: "2026-09-21T12:00:00Z" };

test("o contrato que terminou em 30/10 (status cru 'ativo') é 'Encerrado' no filtro, como no selo", () => {
  const c = { status: "ativo", periodo: "[2026-09-30,2026-10-31)", ...ASSINADO, pagamentos_bloco: [] };
  const s = situacaoParaEquipe(c, AGORA);
  assert.equal(s.chave, "encerrado");
  assert.equal(s.rotulo, "Encerrado");
  assert.match(seloParaEquipe(c), /^Encerrado em 30\/10\/2026$/);
});

test("as situações da equipe agrupam o estado da fonte única (nunca o status cru)", () => {
  assert.equal(situacaoParaEquipe({ status: "ativo", periodo: "[2026-11-10,2026-12-11)" }, AGORA).chave, "aguardando_assinatura");
  assert.equal(situacaoParaEquipe({ status: "ativo", periodo: "[2026-11-10,2026-12-11)", assinado_proprietario_em: "x" }, AGORA).chave, "aguardando_assinatura");
  assert.equal(situacaoParaEquipe({ status: "ativo", periodo: "[2026-11-10,2026-12-11)", ...ASSINADO }, AGORA).chave, "aguardando_pagamento");
  const pago = [{ tipo: "aluguel", confirmado_pelo_inquilino: true, anulado_em: null }];
  assert.equal(situacaoParaEquipe({ status: "ativo", periodo: "[2026-11-01,2026-12-11)", ...ASSINADO, pagamentos_bloco: pago }, AGORA).chave, "em_vigencia");
  assert.equal(situacaoParaEquipe({ status: "encerrado_em_acerto" }, AGORA).chave, "em_acerto");
  for (const st of ["concluido", "encerrado_sem_renovacao"]) assert.equal(situacaoParaEquipe({ status: st }, AGORA).chave, "encerrado", st);
  assert.equal(situacaoParaEquipe({ status: "cancelado" }, AGORA).chave, "cancelado");
  for (const r of Object.values(ROTULO_SITUACAO_EQUIPE)) assert.ok(r && r !== "Ativo", r);
});

test("lista do admin: filtro e opções pela situação da fonte única; nada de STATUS cru", () => {
  const s = ler("app/(dashboard)/admin/contratos/page.tsx");
  assert.match(s, /c\.situacao === status/);
  assert.match(s, /ROTULO_SITUACAO_EQUIPE/);
  assert.doesNotMatch(s, /c\.status === status/);
  assert.doesNotMatch(s, /const STATUS: Record/);
  assert.match(ler("lib/data/admin-indicadores.ts"), /situacao: situacaoParaEquipe\(c\)\.chave/);
});
