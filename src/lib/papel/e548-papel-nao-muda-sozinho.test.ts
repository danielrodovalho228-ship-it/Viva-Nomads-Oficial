/*
  E548 — "Ver minhas estadias" (Conta › Avaliações → /dashboard/locacoes) trocava o painel inteiro para o modo morador e
  GRAVAVA: ao voltar, a navegação seguia "Áreas do morador" até a troca manual em Conta. O papel nunca muda sozinho:
  a página de área se desenha pela URL (modoDaRota, E497) e o modo gravado fica como estava.
  Roda: node --test src/lib/papel/e548-papel-nao-muda-sozinho.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { modoDaRota } from "./modo-da-rota.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("a área do morador se desenha pela URL; ao sair, vale o modo escolhido (sem gravação)", () => {
  assert.equal(modoDaRota("/dashboard/locacoes"), "tenant");
  assert.equal(modoDaRota("/dashboard/locacoes/abc"), "tenant");
  assert.equal(modoDaRota("/dashboard/imoveis"), "owner");
  // Páginas comuns (Início, Conta) não decidem o modo: o painel volta ao modo gravado, que não mudou.
  assert.equal(modoDaRota("/dashboard"), null);
  assert.equal(modoDaRota("/dashboard/conta/avaliacoes"), null);
});

test("SincronizarPapel: nenhuma área mexe no estado local (E653: nem a do parceiro) e o parceiro nem chama o servidor", () => {
  const s = ler("src/components/papel/sincronizar-papel.tsx");
  assert.doesNotMatch(s, /setPapel\(/, "a visita a uma área não troca o papel local");
  assert.match(s, /if \(gravacaoPorArea\(alvo, true\) === "nada"\) return;/);
});

test("servidor: abrir a área (origem 'area') só grava o modo no 1º acesso; fora dele nenhum papel grava", () => {
  const a = ler("src/lib/data/papel-actions.ts");
  const i = a.indexOf('if (origem === "area") {');
  const bloco = a.slice(i, a.indexOf("const { error } = await supabase\n    .from(\"profiles\")", i));
  assert.match(bloco, /contaNoPrimeiroAcesso/);
  // E653: a regra é única (gravacaoPorArea): fora do 1º acesso NENHUM papel grava — o parceiro também não.
  assert.match(bloco, /gravacaoPorArea\(papel, contaNoPrimeiroAcesso\(a\?\.intencao, a\?\.papel_ativo\)\) === "nada" \|\| !modo\) return \{ ok: true \};/);
  // A troca explícita (selo/Conta) continua gravando: usarPapel(papel) sem origem.
  assert.match(ler("src/components/papel/use-troca-papel.ts"), /usarPapel\(papel\)/);
});
