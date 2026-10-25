/*
  Guardas das telas do cadastro no iPhone (P0 08/10): datas e cartão de etiqueta.
  Leitura do código-fonte (node --test, sem navegador); o teste WebKit fica no E2E.
*/
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("cadastro novo (prompt 10, Q8/Q9): UM seletor de data — o calendário nativo, sem máscara — com exemplo dd/mm/aaaa no iOS", () => {
  const campos = ler("src/app/(dashboard)/dashboard/imoveis/novo/campos.tsx");
  const preco = ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-preco.tsx");
  assert.match(campos, /type="date"/);
  // E136: por cima do campo nativo, SEMPRE a data em pt-BR (ou o exemplo dd/mm/aaaa) — nunca "Oct 25, 2026".
  assert.match(campos, /\{value \? isoParaBr\(value\) : "dd\/mm\/aaaa"\}/);
  assert.match(campos, /min-w-0 max-w-full appearance-none/);
  assert.doesNotMatch(preco, /DateFieldBR|inputMode="numeric"/);
  assert.equal((preco.match(/<CampoDataUnico/g) ?? []).length, 2);
});

test("edição: datas de disponibilidade usam o campo dd/mm/aaaa, não <input type=date> (vazio no iOS)", () => {
  for (const p of ["src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx"]) {
    const src = ler(p);
    assert.ok(!/type="date"/.test(src), `${p} ainda tem type="date"`);
    assert.ok(src.includes("DateFieldBR"), `${p} sem DateFieldBR`);
  }
  assert.match(ler("src/components/ui/date-field-br.tsx"), /placeholder="dd\/mm\/aaaa"/);
});

test("cartão de etiqueta empilha no celular: título, depois contador + etiqueta", () => {
  const src = ler("src/app/(dashboard)/qualificar/qualificar-client.tsx");
  assert.match(src, /flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between/);
  assert.ok(src.indexOf("{title}") < src.indexOf("marcados\n"), "título deve vir antes do contador");
});
