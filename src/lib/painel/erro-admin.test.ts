/*
  Tela de erro do admin: uma falha numa tela da equipe fica na casca do admin (error.tsx em /admin), com "Tentar de
  novo" e a volta ao início do admin, em vez de subir até a página de erro pública da raiz.
  Roda: node --test src/lib/painel/erro-admin.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const RAIZ = new URL("../../../", import.meta.url);
const ler = (p: string) => readFileSync(new URL(p, RAIZ), "utf8");
const TELA = "src/app/(dashboard)/admin/error.tsx";

test("o admin tem a própria tela de erro: client, unstable_retry (ou reset) e volta a /admin", () => {
  assert.ok(existsSync(new URL(TELA, RAIZ)));
  const t = ler(TELA);
  assert.match(t, /^"use client";/);
  assert.match(t, /export default function ErroDoAdmin\(\{ unstable_retry, reset \}/);
  assert.match(t, /const tentarDeNovo = \(\) => \(unstable_retry \?\? reset\)\?\.\(\);/);
  assert.match(t, /onClick=\{tentarDeNovo\}/);
  assert.match(t, /data-testid="admin-erro"/);
  assert.match(t, /href="\/admin"/);
  // Nada da saída pública (início do site, atendimento ao cliente) dentro do admin.
  assert.doesNotMatch(t, /href="\/"|href="\/ajuda"/);
});

test("o 404 do layout do admin (quem não é admin) não passa por esta tela: o layout continua acima dela", () => {
  // error.tsx não cobre o layout do mesmo segmento (docs do Next 16): o notFound() do layout segue para a 404 pública.
  assert.match(ler("src/app/(dashboard)/admin/layout.tsx"), /if \(profile\?\.role !== "admin"\) notFound\(\);/);
  assert.ok(!existsSync(new URL("src/app/(dashboard)/admin/not-found.tsx", RAIZ)), "admin sem not-found próprio: a área não se revela");
});
