/*
  E222-B — renovar = aditivo de prorrogação já preenchido. Um caminho só.
  Roda: node --test src/lib/estadia/renovacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HREF_RENOVAR, TEXTO_NO_MAXIMO, TETO_DIAS, previaDaRenovacao, renovacaoPossivel } from "./renovacao.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("mais 1 bloco do tamanho padrão do contrato, limitado ao que falta até 180 dias", () => {
  // 2 meses, bloco padrão de 2: sugere 4; dá para escolher 3 a 6.
  assert.deepEqual(renovacaoPossivel([{ meses: 2 }], 2), { mesesAtuais: 2, mesesQueCabem: 4, mesesSugeridos: 4, opcoes: [3, 4, 5, 6] });
  // 5 meses, bloco padrão de 3: só cabe 1.
  assert.deepEqual(renovacaoPossivel([{ meses: 3 }, { meses: 2 }], 3), { mesesAtuais: 5, mesesQueCabem: 1, mesesSugeridos: 6, opcoes: [6] });
  // Bloco padrão maior que 90 dias fica no máximo do bloco (3 meses).
  assert.equal(renovacaoPossivel([{ meses: 1 }], 5)?.mesesSugeridos, 4);
});

test("no teto (6 meses = 180 dias) não há renovação: a tela mostra a frase do máximo", () => {
  assert.equal(TETO_DIAS, 180);
  assert.equal(renovacaoPossivel([{ meses: 3 }, { meses: 3 }], 2), null);
  assert.equal(renovacaoPossivel([], 2), null);
  assert.equal(TEXTO_NO_MAXIMO, "Esta estadia já chegou ao máximo de 180 dias.");
});

test("a prévia: o período acrescentado começa no dia seguinte à saída e o valor é mensal × meses", () => {
  const p = previaDaRenovacao([{ fim: "2026-12-30", meses: 2 }], 3200, 4);
  assert.deepEqual(p, { meses: 2, inicio: "2026-12-31", fim: "2027-02-28", valor: 6400 });
  assert.equal(previaDaRenovacao([{ fim: "2026-12-30", meses: 2 }], 3200, 2), null, "sem meses a mais não há prévia");
  assert.equal(previaDaRenovacao([{ fim: "2026-12-30", meses: 2 }], 3200, 7), null, "acima do teto não há prévia");
});

test("o botão, o e-mail e a carteira levam ao MESMO fluxo (o aditivo aberto como renovação)", () => {
  assert.equal(HREF_RENOVAR("abc"), "/dashboard/estadia/abc/alteracao?renovar=1");
  const detalhe = ler("src/components/contrato/contrato-detalhe.tsx");
  assert.match(detalhe, /<ButtonLink href=\{HREF_RENOVAR\(c\.id\)\} variant="secondary"/, "botão de contorno; o cheio segue a ação principal");
  assert.match(detalhe, /\{TEXTO_NO_MAXIMO\}/);
  assert.match(ler("src/app/api/cron/automacoes/route.ts"), /tipo: "renovacao_aviso",[\s\S]{0,200}url: HREF_RENOVAR\(c\.id as string\)/);
  assert.match(ler("src/app/(dashboard)/dashboard/carteira/carteira-client.tsx"), /href=\{HREF_RENOVAR\(i\.contratoId\)\}[^>]*data-testid="carteira-preparar-renovacao"/);
});

test("a renovação manda só os meses pelo aditivo que já existe (proporAlteracao), sem caminho próprio", () => {
  const tela = ler("src/app/(dashboard)/dashboard/estadia/[contratoId]/alteracao/alteracao-tela.tsx");
  assert.match(tela, /renovacao\s*\n?\s*\? \{ inicio: null, meses, ocupantes: null, valorMensal: null \}/);
  assert.match(tela, /useState\(renovacao\?\.sugeridos \?\? atual\.meses\)/);
  const pagina = ler("src/app/(dashboard)/dashboard/estadia/[contratoId]/alteracao/page.tsx");
  assert.match(pagina, /\(await searchParams\)\.renovar === "1"/);
  assert.match(pagina, /renovar && podePropor && !renovacao \?/);
  // O aditivo assinado aplica os blocos, dispara estadia_remarcada (E213) e o lembrete do bloco (E205-B2).
  const acoes = ler("src/lib/data/estadia-actions.ts");
  assert.match(acoes, /evento\(ctx\.admin, a\.contrato_id, ctx\.userId, "estadia_remarcada"/);
  assert.match(acoes, /after\(\(\) => lembreteDeBlocoNoAceite\(ctx\.admin, a\.contrato_id\)/);
});

test("nenhuma chamada ao renovarBloco sobra no produto", () => {
  for (const f of [
    "src/lib/data/actions.ts",
    "src/components/contrato/contrato-detalhe.tsx",
    "src/app/(dashboard)/dashboard/estadia/[contratoId]/alteracao/alteracao-tela.tsx",
    "src/app/(dashboard)/dashboard/carteira/carteira-client.tsx",
    "src/app/api/cron/automacoes/route.ts",
  ])
    assert.doesNotMatch(ler(f), /renovarBloco/, f);
});
