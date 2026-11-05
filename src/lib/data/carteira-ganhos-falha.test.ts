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
  assert.match(ler("src/app/(dashboard)/dashboard/carteira/page.tsx"), /await getCarteiraDoDono\(undefined, \{ exigir: true \}\)/);
  // E545: Ganhos lê um contrato por linha (getGanhosDoDono), com o mesmo exigir.
  assert.match(ler("src/app/(dashboard)/dashboard/ganhos/page.tsx"), /await getGanhosDoDono\(undefined, \{ exigir: true \}\)/);
  const src = ler("src/lib/data/carteira.ts");
  assert.match(src.slice(src.indexOf("export async function getGanhosDoDono")), /listMyProperties\(\{ exigir: opcoes\.exigir \}\), getMeusContratos\(\{ exigir: opcoes\.exigir \}\)/);
});
