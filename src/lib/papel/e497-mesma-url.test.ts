/*
  E497 (família E456) — "mesma URL, dois conteúdos" na área logada: /dashboard/leads e /dashboard/contratos mudavam de
  layout/título/menu entre acessos próximos.
  Causa: o modo (morador × dono) que escolhe menu, título e o lado dos contratos só existia no navegador — no servidor
  era null (cai no padrão), no 1º render do cliente vinha do aparelho e depois mudava de novo (o perfil chegava; e numa
  página de área o SincronizarPapel trocava o modo DEPOIS da pintura). A mesma URL pintava um conteúdo e trocava.
  Correção:
  1. página de ÁREA (ex.: /dashboard/leads) decide o modo pela própria URL, já no 1º render (servidor e cliente);
  2. /dashboard/contratos recebe do servidor o modo do perfil (resolveInitialMode, a mesma regra do login) e pinta esse
     lado até a página montar — sem o "pisca" do padrão.
  Roda: node --test src/lib/papel/e497-mesma-url.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { modoDaRota } from "./modo-da-rota.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("puro: a área decide o modo pela URL; página comum não decide", () => {
  assert.equal(modoDaRota("/dashboard/leads"), "owner");
  assert.equal(modoDaRota("/dashboard/leads/123"), "owner");
  assert.equal(modoDaRota("/dashboard/favoritos"), "tenant");
  assert.equal(modoDaRota("/dashboard/contratos"), null);
  assert.equal(modoDaRota("/dashboard/mensagens"), null);
  assert.equal(modoDaRota("/dashboard/leadsx"), null);
  assert.equal(modoDaRota(null), null);
});

test("useViewMode usa o modo da área antes do modo guardado (1º render igual no servidor e no cliente)", () => {
  const r = ler("src/lib/roles.ts");
  assert.match(r, /const daArea = modoDaRota\(usePathname\(\)\);/);
  assert.match(r, /mode: daArea \?\? resolveMode\(user, activeMode\)/);
});

test("contratos: o servidor manda o modo do perfil e o componente pinta esse lado até montar", () => {
  const p = ler("src/app/(dashboard)/dashboard/contratos/page.tsx");
  assert.match(p, /resolveInitialMode\(\)/);
  assert.match(p, /modoInicial=\{modoInicial\}/);
  const c = ler("src/app/(dashboard)/dashboard/contratos/contratos-por-modo.tsx");
  assert.match(c, /const mode = montado \? modoEmUso : \(modoInicial \?\? modoEmUso\);/);
});
