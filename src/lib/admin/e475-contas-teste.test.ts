/*
  E475 (AD6) — contas de teste 14 × 13: a tela Testes dizia "Contas de teste · 14 · 13 proprietários e inquilinos (os de
  Usuários) · 1 da equipe" e Usuários dizia "13 de teste" — a explicação do E334 no título não acabou com a divergência
  (produção, 05/11: 4 proprietários + 9 inquilinos + 1 admin observador da QA, todos is_teste).
  Correção — fonte única: o número de "Contas de teste" é o MESMO de Usuários, pela MESMA função (contarUsuarios).
  A lista mostra essas contas; a conta da equipe (o admin observador) e as anonimizadas ficam num painel à parte,
  "Outras contas marcadas como teste", com o motivo de não entrarem em Usuários.
  Roda: node --test src/lib/admin/e475-contas-teste.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { separarContasTeste } from "./contagens.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("separa as contas de Usuários das outras, pela mesma regra de papéis", () => {
  const contas = [
    ...Array.from({ length: 4 }, (_, i) => ({ id: `o${i}`, role: "owner", anonymized_at: null })),
    ...Array.from({ length: 9 }, (_, i) => ({ id: `t${i}`, role: "tenant", anonymized_at: null })),
    { id: "adm", role: "admin", anonymized_at: null },
    { id: "anon", role: "tenant", anonymized_at: "2026-10-01" },
  ];
  const { deUsuarios, outras } = separarContasTeste(contas);
  assert.equal(deUsuarios.length, 13);
  assert.deepEqual(outras.map((c) => c.id), ["adm", "anon"]);
});

test("a tela Testes mostra o número de Usuários (contarUsuarios) e as outras à parte", () => {
  const pg = ler("app/(dashboard)/admin/dados-de-teste/page.tsx");
  assert.match(pg, /contarUsuarios\(admin\)/);
  assert.match(pg, /title=\{`Contas de teste · \$\{numeroTeste\}`\}/);
  assert.match(pg, /data-testid="contas-teste-outras"/);
  assert.match(pg, /Outras contas marcadas como teste/);
  assert.doesNotMatch(pg, /textoContasTeste\(/);
  // E a fonte de Usuários é a mesma função.
  assert.match(ler("components/admin/numero-da-fonte.tsx"), /usuarios: contarUsuarios,/);
});
