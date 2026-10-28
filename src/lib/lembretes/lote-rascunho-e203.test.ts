/*
  E203 — lote das 08:00: no máximo 1 e-mail de rascunho por dono por dia; botão com o PRÓXIMO passo como ação.
  Roda: node --test src/lib/lembretes/lote-rascunho-e203.test.ts
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { acaoDoPasso, linhaOutrosRascunhos, rascunhosPorDono } from "./regras.ts";
import { OBRIGATORIOS_ROTULOS } from "../anuncio/prontidao.ts";

const ler = (rel: string) => readFileSync(new URL(`../../../${rel}`, import.meta.url), "utf8");

test("caso de 28/10: 3 rascunhos do mesmo dono com o mesmo título viram UM e-mail (o mais recente), os outros listados", () => {
  const daniel = "u-daniel";
  const r = rascunhosPorDono([
    { id: "a", ownerId: daniel, titulo: "Studio com 2 quartos vem morar aqui", criadoEm: "2026-10-20T10:00:00Z" },
    { id: "b", ownerId: daniel, titulo: "Studio com 2 quartos vem morar aqui", criadoEm: "2026-10-22T10:00:00Z" },
    { id: "c", ownerId: daniel, titulo: "Studio com 2 quartos vem morar aqui", criadoEm: "2026-10-21T10:00:00Z" },
    { id: "d", ownerId: "outro", titulo: "Apto", criadoEm: "2026-10-21T10:00:00Z" },
  ]);
  assert.equal(r.length, 2, "um e-mail por dono");
  const doDaniel = r.find((x) => x.principal.ownerId === daniel)!;
  assert.equal(doDaniel.principal.id, "b", "o mais recente vai no assunto e no botão");
  assert.deepEqual(doDaniel.outros.map((o) => o.id), ["c", "a"]);
  assert.equal(linhaOutrosRascunhos(doDaniel.outros.map((o) => o.titulo)), "Você também tem 2 rascunhos parados: Studio com 2 quartos vem morar aqui; Studio com 2 quartos vem morar aqui.");
  assert.equal(linhaOutrosRascunhos([]), "");
  assert.equal(linhaOutrosRascunhos([""]), "Você também tem 1 rascunho parado: Rascunho de anúncio.");
});

test("botão: o próximo passo como AÇÃO, nunca o rótulo de item feito ('Endereço preenchido')", () => {
  assert.equal(acaoDoPasso({ key: "endereco", label: OBRIGATORIOS_ROTULOS[0] }), "Preencher o endereço");
  assert.equal(acaoDoPasso({ key: "fotos", label: OBRIGATORIOS_ROTULOS[3] }), "Enviar as fotos");
  assert.equal(acaoDoPasso({ key: "documento", label: OBRIGATORIOS_ROTULOS[8] }), "Enviar o documento do imóvel");
  assert.equal(acaoDoPasso({ key: "novo_item", label: "Algo novo" }), "Completar: Algo novo");
  // Todo item obrigatório do checklist tem ação própria (nenhum cai no genérico).
  for (const key of ["endereco", "detalhes", "periodo", "fotos", "titulo", "descricao", "preco", "garantia", "documento", "qualificacao", "tipo_entrada", "internet", "sem_internet", "chacara", "privacidade", "conforto", "sublocacao", "limite"]) {
    assert.doesNotMatch(acaoDoPasso({ key, label: "x" }), /^Completar:/, key);
  }
});

test("GUARDA do cron: agrupa por dono, chave do dia por dono, marca os outros e o botão usa acaoDoPasso", () => {
  const cron = ler("src/app/api/cron/automacoes/route.ts");
  assert.match(cron, /rascunhosPorDono\(pendentes\)/);
  assert.match(cron, /chaveEnvio\("anuncio_incompleto", `dia-\$\{hoje\}`, ownerId\)/);
  assert.match(cron, /ctaLabel: lista\?\.proximo \? acaoDoPasso\(lista\.proximo\) : undefined/);
  assert.doesNotMatch(cron, /`Continuar: \$\{lista\.proximo\.label\}`/);
  assert.match(cron, /chave: chaveDoDia\(principal\.ownerId\)/);
  // A trava de produção não muda: sem AUTOMACOES_ATIVO=1 o cron segue simulando.
  assert.match(cron, /modoSimulado\(new URL\(request\.url\)\.searchParams\.get\("simular"\), process\.env\.AUTOMACOES_ATIVO\)/);
});
