/*
  Auditoria de erros e estados vazios — achado nº 12: "Carteira" e "Ganhos" do dono mostravam a carteira vazia e "R$ 0"
  de ganhos quando a leitura dos imóveis ou dos contratos falhava. Agora as duas telas pedem com `exigir`: a falha lança
  e o painel mostra "Não conseguimos abrir esta tela" com "Tentar de novo".
  Roda: node --test src/lib/data/carteira-ganhos-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("a carteira repassa exigir às leituras de imóveis e contratos", () => {
  const src = ler("src/lib/data/carteira.ts");
  assert.match(src, /export async function getCarteiraDoDono\(hojeISO = hojeBR\(\), opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(src, /listMyProperties\(\{ exigir: opcoes\.exigir \}\), getMeusContratos\(\{ exigir: opcoes\.exigir \}\)/);
});

test("Carteira e Ganhos pedem com exigir", () => {
  for (const f of ["src/app/(dashboard)/dashboard/carteira/page.tsx", "src/app/(dashboard)/dashboard/ganhos/page.tsx"]) {
    assert.match(ler(f), /await getCarteiraDoDono\(undefined, \{ exigir: true \}\)/, f);
  }
});
