/*
  Guardas das telas do cadastro no iPhone (P0 08/10): datas e cartão de etiqueta.
  Leitura do código-fonte (node --test, sem navegador); o teste WebKit fica no E2E.
*/
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("datas de disponibilidade usam o campo dd/mm/aaaa, não <input type=date> (vazio no iOS)", () => {
  for (const p of ["src/app/(dashboard)/dashboard/imoveis/novo/page.tsx", "src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx"]) {
    const src = ler(p);
    assert.ok(!/type="date"/.test(src), `${p} ainda tem type="date"`);
    assert.ok(src.includes("DateFieldBR"), `${p} sem DateFieldBR`);
  }
  assert.match(ler("src/components/ui/date-field-br.tsx"), /placeholder="dd\/mm\/aaaa"/);
});

test("cartão de etiqueta empilha no celular: título, depois contador + etiqueta", () => {
  const src = ler("src/app/(dashboard)/qualificar/page.tsx");
  assert.match(src, /flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between/);
  assert.ok(src.indexOf("{title}") < src.indexOf("marcados\n"), "título deve vir antes do contador");
});
