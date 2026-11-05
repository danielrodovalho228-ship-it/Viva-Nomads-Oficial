/*
  E611: telas do cadastro lentas — no Passo 9, o calendário em "Carregando" e o link de exportação em "Carregando o
  link…" por segundos. Causa: o Next despacha as Server Actions UMA POR VEZ por aba (docs: server-actions.md,
  "Sequential dispatch on the client"); as leituras do calendário eram Server Actions e esperavam o autosave e as outras
  ações da tela. Agora: leituras por GET (rota própria) e as gravações independentes do autosave em paralelo.
  Roda: node --test src/lib/calendario/e611-leituras-fora-da-fila.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("E611: o calendário e o link de exportação leem por GET, não por Server Action", () => {
  const cal = ler("src/components/property/block-calendar.tsx");
  const exp = ler("src/components/property/exportar-calendario.tsx");
  for (const f of [cal, exp]) {
    assert.doesNotMatch(f, /\b(getBlocks|getEstadiasDoImovel|linkExportacaoCalendario)\(/);
    assert.match(f, /from "@\/lib\/calendario\/leitura-cliente"/);
  }
  const cliente = ler("src/lib/calendario/leitura-cliente.ts");
  assert.doesNotMatch(cliente, /"use server"/);
  assert.match(cliente, /fetch\(`\/api\/imoveis\/\$\{encodeURIComponent\(propertyId\)\}\/calendario\?parte=\$\{parte\}`/);
  // falha continua lançando (a tela mostra o aviso com "Tentar de novo")
  assert.match(cliente, /if \(!r\.ok \|\| !j\?\.ok\) throw new Error/);
});

test("E611: a rota usa as mesmas leituras (mesma autorização) e não guarda cache", () => {
  const rota = ler("src/app/api/imoveis/[id]/calendario/route.ts");
  assert.match(rota, /export async function GET\(/);
  assert.match(rota, /getBlocks\(id\)/);
  assert.match(rota, /getEstadiasDoImovel\(id, \{ exigir: true \}\)/);
  assert.match(rota, /linkExportacaoCalendario\(id\)/);
  assert.match(rota, /"cache-control": "no-store"/);
});

test("E611: o autosave grava as quatro partes independentes em paralelo", () => {
  const a = ler("src/lib/data/actions.ts");
  const f = a.slice(a.indexOf("export async function saveDraftData"), a.indexOf("const { data, error } = await supabase.from(\"properties\").insert(fields)"));
  assert.match(f, /await Promise\.all\(\[\s*gravarChegadaEPedido\([\s\S]*?sincronizarFotos\([\s\S]*?ligarQualificacaoAoImovel\([\s\S]*?ligarMatriculaAoImovel\(/);
  assert.doesNotMatch(f, /await sincronizarFotos\(/);
});
