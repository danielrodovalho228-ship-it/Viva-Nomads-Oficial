/*
  Prompt 36, item 3b — o selo "N aguardando" da barra lateral do admin atualiza depois de aprovar/recusar.
  Roda: node --test src/lib/admin/fila-evento.test.ts
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EVENTO_FILA_DOCUMENTOS, avisarFilaDocumentosMudou } from "./fila-evento.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("o aviso dispara o evento no navegador e não quebra no servidor", () => {
  assert.doesNotThrow(() => avisarFilaDocumentosMudou());
  const vistos: string[] = [];
  const g = globalThis as unknown as { window?: unknown };
  g.window = { dispatchEvent: (e: Event) => vistos.push(e.type) };
  try {
    avisarFilaDocumentosMudou();
  } finally {
    delete g.window;
  }
  assert.deepEqual(vistos, [EVENTO_FILA_DOCUMENTOS]);
});

test("a barra lateral lê o número de novo quando a fila avisa (além da troca de rota)", () => {
  const s = ler("src/components/layout/dashboard-shell.tsx");
  assert.match(s, /window\.addEventListener\(EVENTO_FILA_DOCUMENTOS, aoMudar\)/);
  assert.match(s, /window\.removeEventListener\(EVENTO_FILA_DOCUMENTOS, aoMudar\)/);
  assert.match(s, /\}, \[display\.role, pathname, filaMudou\]\);/);
});

test("documentos e matrículas: decidir avisa o selo e chama router.refresh dentro de startTransition", () => {
  for (const f of ["src/app/(dashboard)/admin/documentos/admin-documentos-client.tsx", "src/app/(dashboard)/admin/documentos/matriculas-admin-client.tsx"]) {
    const s = ler(f);
    assert.match(s, /avisarFilaDocumentosMudou\(\);\n\s+startTransition\(\(\) => router\.refresh\(\)\);/, f);
  }
  assert.match(ler("src/lib/data/documentos-admin.ts"), /revalidatePath\("\/admin", "layout"\);/);
  assert.match(ler("src/lib/data/matriculas-admin.ts"), /revalidatePath\("\/admin", "layout"\);/);
});
