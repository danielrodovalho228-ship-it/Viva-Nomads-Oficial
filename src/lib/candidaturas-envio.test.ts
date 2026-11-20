/*
  E657 (reprova de 07/11) — a candidatura VN-PD-A65945B6 (criada em 04/11, reenviada em 06/11 21:09 BRT) seguia mostrando "Enviada em
  04/11/2026", sem selo de reenvio e sem segunda data, e o DONO não via "Enviada em" em vista nenhuma.
  Causa: a coluna `leads.reenviada_em` (migração 0315, PR #3083) ainda não está em produção — o PR é rascunho —; o banco guardava só
  `created_at`. Aqui: a regra única do envio, o selo "Reenviada" com a data do primeiro envio, a data nas duas vistas do dono e o
  preenchimento do caso conhecido (a mensagem do reenvio tem o carimbo).
  Roda: node --test src/lib/candidaturas-envio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { envioDaCandidatura } from "./candidaturas-envio.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("sem reenvio: vale a criação, sem selo e sem segunda data", () => {
  assert.deepEqual(envioDaCandidatura("2026-11-04T23:37:32Z", null), { enviadaEm: "2026-11-04T23:37:32Z", reenviada: false, primeiroEnvioEm: null });
  assert.deepEqual(envioDaCandidatura(null, null), { enviadaEm: null, reenviada: false, primeiroEnvioEm: null });
});

test("com reenvio: vale o último envio, com o selo e a data do primeiro envio", () => {
  assert.deepEqual(envioDaCandidatura("2026-11-04T23:37:32Z", "2026-11-07T00:09:00Z"), {
    enviadaEm: "2026-11-07T00:09:00Z",
    reenviada: true,
    primeiroEnvioEm: "2026-11-04T23:37:32Z",
  });
  // reenvio anterior à criação (dado torto): não vale, volta à criação
  assert.equal(envioDaCandidatura("2026-11-05T10:00:00Z", "2026-11-01T10:00:00Z").reenviada, false);
});

test("morador: a lista mostra o selo 'Reenviada' e 'Enviada pela primeira vez em …'", () => {
  const pg = ler("src/app/(dashboard)/dashboard/candidaturas/page.tsx");
  assert.match(pg, /data-testid="candidatura-reenviada"/);
  assert.match(pg, /Reenviada/);
  assert.match(pg, /Enviada pela primeira vez em \{dataBRT\(c\.primeiroEnvioEm\)\}/);
  const acoes = ler("src/lib/data/leads-actions.ts");
  assert.match(acoes, /envioDaCandidatura\(r\.created_at, r\.reenviada_em\)/);
});

test("dono: Interessados e o perfil do candidato mostram 'Enviada em' (e 'Reenviada'), sem mexer na máscara do candidato", () => {
  const dados = ler("src/lib/data/leads.ts");
  assert.match(dados, /envioDaCandidatura\(r\.created_at, reenviadas\.get\(r\.id\) \?\? null\)/);
  // A coluna nova NUNCA entra na leitura principal: se a migração atrasar, a lista do dono não quebra.
  assert.doesNotMatch(dados, /property_id,\s*reenviada_em/);
  assert.match(dados, /select\("id, reenviada_em"\)/);
  const cliente = ler("src/app/(dashboard)/dashboard/leads/leads-client.tsx");
  assert.match(cliente, /data-testid="lead-enviada-em"/);
  const perfil = ler("src/app/(dashboard)/dashboard/leads/[id]/page.tsx");
  assert.match(perfil, /data-testid="lead-enviada-em"/);
});

test("o caso VN-PD-A65945B6: a 0315 preenche o reenvio a partir da mensagem do próprio reenvio, só entre contas de teste", () => {
  const m = ler("supabase/migrations/0315_candidatura_reenviada_em_e657.sql");
  const a = ler("supabase/producao/aplicar-0315.sql");
  for (const t of [m, a]) {
    assert.match(t, /a65945b6-1c11-4e89-95c7-e4a0fde6f616/);
    assert.match(t, /update public\.leads/);
    assert.match(t, /reenviada_em is null/);
    assert.match(t, /is_teste/);
    assert.match(t, /from public\.messages/);
  }
  const r = ler("supabase/producao/rollback/0315_rollback.sql");
  assert.match(r, /a65945b6-1c11-4e89-95c7-e4a0fde6f616/);
});
