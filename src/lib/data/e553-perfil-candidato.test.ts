/*
  E553 (parte B, rota e dados) — o cartão de lead não abria o perfil completo do candidato. Agora existe a rota
  /dashboard/leads/<id> com os dados pela MESMA fonte e máscara do cartão; a ligação visual do cartão é da Pista A.
  Roda: node --test src/lib/data/e553-perfil-candidato.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hrefPerfilCandidato, linkCandidaturaDono } from "../notifications/dados-candidatura.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("rota do perfil do candidato e volta para o cartão", () => {
  assert.equal(hrefPerfilCandidato("0b8e7a52-1111-4222-8333-944445555666"), "/dashboard/leads/0b8e7a52-1111-4222-8333-944445555666");
  assert.equal(linkCandidaturaDono("abc"), "/dashboard/leads#candidato-abc");
});

test("dados: a mesma leitura e a mesma máscara do cartão (listLeads), só do dono, id estranho → null", () => {
  const d = ler("src/lib/data/leads.ts");
  const fn = d.slice(d.indexOf("export async function perfilDoCandidato"));
  assert.match(fn, /if \(!UUID_LEAD\.test\(leadId\)\) return null;/);
  assert.match(fn, /const leads = await listLeads\(\{ exigir: true \}\);/);
  assert.match(fn, /return leads\.find\(\(l\) => l\.id === leadId\) \?\? null;/);
});

test("página: 404 para quem não é o dono; sem contato; volta ao cartão", () => {
  const p = ler("src/app/(dashboard)/dashboard/leads/[id]/page.tsx");
  assert.match(p, /const l = await perfilDoCandidato\(id\);\n\s+if \(!l\) notFound\(\);/);
  assert.match(p, /data-testid="perfil-candidato"/);
  assert.match(p, /href=\{linkCandidaturaDono\(l\.id\)\}/);
  assert.doesNotMatch(p, /email|telefone|phone|createAdminClient/i);
  // A rota fica na área do proprietário (o mesmo prefixo de Interessados).
  assert.match(ler("src/config/areas-por-papel.ts"), /"\/dashboard\/leads",/);
});
