/*
  E849 (Phoenix RELATORIO-017, A-39): o banner "Simulador de rentabilidade" de /para-proprietarios vendia uso livre ("Estime
  quanto o seu imóvel pode render por mês com os números que você digitar") e o botão leva a /dashboard/simulador, que pede
  login — o visitante só descobria depois do clique. Agora o banner diz que o simulador fica na conta e o botão diz "(com
  login)", como o "Anunciar imóvel (com login)" do rodapé. O simulador começa vazio (E294): a frase "A Viva não preenche
  valor nenhum por você" segue verdadeira.
  Roda: node --test src/lib/e849-simulador-com-login.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("o banner diz que o simulador pede login (texto e botão)", () => {
  const s = ler("app/(public)/para-proprietarios/page.tsx");
  const bloco = s.slice(s.indexOf('data-testid="proprietarios-simulador"'), s.indexOf('data-testid="proprietarios-calcular"') + 200);
  assert.match(bloco, /na sua conta/);
  assert.match(bloco, /Calcular rentabilidade \(com login\)/);
  assert.match(bloco, /href="\/dashboard\/simulador"/);
});

test("o simulador do painel começa vazio (a página pode dizer que a Viva não preenche nada)", () => {
  const sim = ler("app/(dashboard)/dashboard/simulador/page.tsx");
  assert.match(sim, /useState<EntradaImovel>\(entradaVazia\)/);
  assert.match(ler("app/(public)/para-proprietarios/page.tsx"), /A Viva não preenche valor nenhum por você\./);
});
