/*
  E602: o assistente de cadastro não tinha caminho além do Passo 2 sem as 8 fotos — "Continuar" desabilitado, sem lista
  de passos nem salto. Agora: as 8 fotos são exigência para PUBLICAR, não para navegar, e há um índice de passos
  clicável com o estado de cada passo.
  Roda: node --test src/lib/anuncio/e602-indice-passos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { indicePassos } from "./indice-passos.ts";
import { estadoPassoFotos, fotosBloqueiamAvanco, motivoAvancoFotos } from "../fotos/conteudo.ts";

const boa = { conteudo: null };

test("E602: com 0 ou 7 fotos, as fotos NÃO seguram a navegação (só a publicação)", () => {
  const zero = estadoPassoFotos([]);
  assert.equal(zero.podeContinuar, false, "publicar segue barrado");
  assert.equal(zero.trava, "faltam");
  assert.equal(fotosBloqueiamAvanco(zero), false);
  assert.match(zero.mensagem ?? "", /para publicar \(mínimo de 8\)/);
  assert.equal(fotosBloqueiamAvanco(estadoPassoFotos(Array.from({ length: 7 }, () => boa))), false);
});

test("E602: abaixo de 8, uma foto sinalizada ainda segura o avanço (com o motivo da foto, não a contagem)", () => {
  const sinal = { conteudo: { naoImovel: true, motivo: null } };
  const e = estadoPassoFotos([sinal, boa]);
  assert.equal(e.trava, "faltam");
  assert.equal(fotosBloqueiamAvanco(e), true);
  assert.equal(motivoAvancoFotos(e), "1 foto não parece ser do imóvel. Remova ou confirme cada uma para continuar.");
  assert.equal(motivoAvancoFotos(estadoPassoFotos([boa, boa])), null);
});

test("E602: foto ou vídeo sinalizado (não parece do imóvel) segue pedindo ação antes de avançar", () => {
  const sinal = { conteudo: { naoImovel: true, motivo: null } };
  const e = estadoPassoFotos([...Array.from({ length: 8 }, () => boa), sinal]);
  assert.equal(e.trava, "sinalizadas");
  assert.equal(fotosBloqueiamAvanco(e), true);
  assert.equal(fotosBloqueiamAvanco(estadoPassoFotos(Array.from({ length: 8 }, () => boa))), false);
});

const conf = {
  itens: [
    { etapa: 2, id: "fotos" as const, rotulo: "Fotos", ok: false, faltam: ["8 fotos (tem 0)"] },
    { etapa: 3, id: "endereco" as const, rotulo: "Endereço", ok: true, faltam: [] },
    { etapa: 8, id: "preco" as const, rotulo: "Preço", ok: false, faltam: ["Valor mensal"] },
  ],
  pendentesNaRevisao: ["Documento do imóvel"],
};

test("E602: o índice tem os 10 passos, o atual marcado e o estado de cada um", () => {
  const ind = indicePassos(conf, 2, 2);
  assert.equal(ind.length, 10);
  assert.deepEqual(ind.map((p) => p.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(ind[2].estado, "atual");
  assert.equal(ind[1].estado, "falta");
  assert.deepEqual(ind[1].faltam, ["8 fotos (tem 0)"]);
  assert.equal(ind[0].estado, "feito");
  assert.equal(ind[7].estado, "falta", "falta aparece mesmo em passo ainda não visitado");
  assert.equal(ind[4].estado, "a-fazer", "passo sem pendência e não visitado");
  assert.equal(ind[9].estado, "falta");
  assert.deepEqual(ind[9].faltam, ["Documento do imóvel"]);
  // a posição (0-based) é a do assistente: clicar leva a ETAPA[pos]
  assert.equal(ind[1].pos, 1);
});

test("E602: passo visitado e sem pendência fica 'feito'", () => {
  const ind = indicePassos({ itens: [], pendentesNaRevisao: [] }, 6, 6);
  assert.equal(ind[4].estado, "feito");
  assert.equal(ind[7].estado, "a-fazer");
  assert.equal(ind[9].estado, "a-fazer");
});

test("E602: a tela usa o índice e não desabilita o Continuar pela contagem de fotos", () => {
  const tela = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");
  assert.match(tela, /<IndicePassos/);
  assert.match(tela, /fotosBloqueiamAvanco\(passoFotos\)/);
  assert.doesNotMatch(tela, /step === ETAPA\.fotos && !passoFotos\.podeContinuar/);
  // a publicação continua exigindo as fotos
  assert.match(tela, /!asDraft && !passoFotos\.podeContinuar/);
});

test("E602: a grade da página tem coluna minmax(0,1fr) também no celular (a faixa do índice não alarga a página)", () => {
  const tela = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");
  assert.match(tela, /"grid grid-cols-\[minmax\(0,1fr\)\] gap-8 lg:items-start"/);
});

test("E602: o índice não tem faixa que rola de lado — os passos quebram em linhas (t468: a faixa alargava a página)", () => {
  const comp = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/indice-passos.tsx", import.meta.url), "utf8");
  assert.match(comp, /<ol className="flex flex-wrap gap-2">/);
  assert.doesNotMatch(comp, /overflow-x-auto/);
  assert.doesNotMatch(comp, /shrink-0/);
  // no celular, só o número na tela; o nome completo vai para o leitor de tela e para o title
  assert.match(comp, /sr-only sm:not-sr-only/);
});
