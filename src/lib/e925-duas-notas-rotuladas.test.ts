/* Roda: node --test src/lib/e925-duas-notas-rotuladas.test.ts
   E925 (Phoenix, A-254; esclarecimento do Gerente): na página do imóvel convivem a nota do imóvel ("5,0 · 2 avaliações", no topo) e a
   do proprietário ("4,7 · 11 avaliações", no bloco "Sobre o proprietário"), sem rótulo que as distinga à primeira leitura.
   Correção: cada uma diz de quem é — "avaliações do imóvel" e "avaliações do proprietário". Os números e a fonte de cada uma não mudam. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");
const SEM_NBSP = (s: string) => s.replace(/ /g, " ");

test("E925: os dois rótulos são distintos e dizem de quem é a nota (singular e plural)", async () => {
  const { rotuloAvaliacoes, textoDaNota } = await import("./imovel/rotulo-avaliacoes.ts");
  assert.equal(rotuloAvaliacoes(2, "imovel"), "avaliações do imóvel");
  assert.equal(rotuloAvaliacoes(11, "proprietario"), "avaliações do proprietário");
  assert.equal(rotuloAvaliacoes(1, "imovel"), "avaliação do imóvel");
  assert.equal(rotuloAvaliacoes(1, "proprietario"), "avaliação do proprietário");
  assert.notEqual(rotuloAvaliacoes(2, "imovel"), rotuloAvaliacoes(2, "proprietario"));
  // O caso do relatório: os números ficam como eram; só ganham o rótulo.
  assert.equal(SEM_NBSP(textoDaNota(5, 2, "imovel")), "5,0 · 2 avaliações do imóvel");
  assert.equal(SEM_NBSP(textoDaNota(4.7, 11, "proprietario")), "4,7 · 11 avaliações do proprietário");
  assert.equal(SEM_NBSP(textoDaNota(4.666, 3, "imovel")), "4,7 · 3 avaliações do imóvel");
  assert.equal(SEM_NBSP(textoDaNota(5, 1, "proprietario")), "5,0 · 1 avaliação do proprietário");
});

test("E925 (estático): a nota do topo da página é 'do imóvel' e a do bloco do proprietário é 'do proprietário'", () => {
  const pagina = ler("src/app/(public)/imoveis/[id]/property-detail.tsx");
  const dono = ler("src/components/property/owner-card.tsx");
  // Topo: o exemplo e o anúncio real escrevem pela mesma função, com o mesmo rótulo; a fonte de cada número não muda.
  assert.match(pagina, /textoDaNota\(resumoExemplo\.media, resumoExemplo\.n, "imovel"\)/);
  assert.match(pagina, /textoDaNota\(mediaReal, reviewsReais, "imovel"\)/);
  assert.match(dono, /textoDaNota\(d\.reputacao\.media, d\.reputacao\.n, "proprietario"\)/);
  // Nenhuma das duas escreve mais "avaliações" solto ao lado do número.
  assert.doesNotMatch(pagina, /\? "avaliação" : "avaliações"\}/);
  assert.doesNotMatch(pagina, /\{resumoExemplo\.n\} avaliações/);
  assert.doesNotMatch(dono, /\? "avaliação" : "avaliações"\}/);
});
