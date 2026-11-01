import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

test("varredura 01/11: campos que não tinham rótulo para leitor de tela", () => {
  const t = ler("components/admin/testar-leitura-ia.tsx");
  assert.match(t, /aria-label="Tipo do arquivo"\s+data-testid="testar-leitura-tipo"/);
  assert.match(t, /aria-label="Arquivo fictício para testar a leitura"\s+data-testid="testar-leitura-arquivo"/);
  assert.match(ler("app/(dashboard)/dashboard/indicacoes/page.tsx"), /readOnly\s+value=\{link\}\s+aria-label="Seu link de indicação"/);
});
