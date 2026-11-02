/*
  Varredura de erros (rodada 8) — falha de leitura não vira "nada marcado", "sem avaliações" nem "nenhum emitido".
  Achado 58: getMinhaIntencao → "[]"/"não respondeu": um toque ou "Salvar" gravava só a opção escolhida por cima.
  Achado 59: getAvaliacoesRecebidas → o perfil público dizia "Ainda sem avaliações publicadas" para quem tem.
  Achado 60: listarEmitidos → "nenhum documento emitido"; a equipe podia reemitir/reenviar o que já saiu.
  Roda: node --test src/lib/data/achado58-60-leituras.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("achado 58: a intenção lança na falha; as três telas não gravam por cima", () => {
  assert.match(ler("src/lib/data/intencao-actions.ts"), /const \{ data, error \} = await supabase\.from\("profiles"\)\.select\("intencao"\)[\s\S]{0,40}if \(error\) throw/);
  // Entrada: sem conseguir ler, segue para o destino (não pergunta de novo).
  assert.match(ler("src/app/auth/intencao/page.tsx"), /getMinhaIntencao\(\)\.catch\(\(\) => "indisponivel" as const\)/);
  const papeis = ler("src/components/account/tela-papeis.tsx");
  assert.match(papeis, /if \(i === "falhou"\) setEstado\("erro_leitura"\);/);
  assert.doesNotMatch(papeis, /getMinhaIntencao\(\)\.catch\(\(\) => null\)/);
  const conta = ler("src/components/auth/escolha-intencao.tsx");
  assert.match(conta, /\.catch\(\(\) => vivo && setFalhouLeitura\(true\)\)/);
  assert.match(conta, /data-testid="minha-intencao-falha"/);
});

test("achado 59: avaliações do perfil público — lança na falha e a página avisa (nunca 'sem avaliações')", () => {
  const s = ler("src/lib/data/perfil-proprietario.ts");
  const fn = s.slice(s.indexOf("export async function getAvaliacoesRecebidas"));
  assert.match(fn, /if \(error\) throw new Error\("Não foi possível ler as avaliações agora\."\);/);
  assert.doesNotMatch(fn.slice(0, fn.indexOf("\n}\n")), /catch \{\s*return \[\];/);
  const pagina = ler("src/app/(public)/proprietario/[id]/page.tsx");
  assert.match(pagina, /getAvaliacoesRecebidas\(id\)\.catch\(\(\) => null\)/);
  assert.match(pagina, /\{avaliacoes === null \? \(/);
  assert.match(pagina, /data-testid="avaliacoes-falha"/);
});

test("achado 60: documentos emitidos lançam na falha (a página cai no aviso de erro do admin)", () => {
  const s = ler("src/lib/data/emitidos-actions.ts");
  assert.match(s.slice(s.indexOf("export async function listarEmitidos")), /if \(error\) throw new Error\("Não foi possível ler os documentos emitidos agora\."\);/);
});
