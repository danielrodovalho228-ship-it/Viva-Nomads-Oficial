/*
  E1079 (ORDEM-DUET-385), fatia 4 — a visita do avaliador pelo mockup aprovado (avaliador-visita): "Visita em andamento",
  a foto do imóvel, o "Roteiro da visita" (marcado pelo que já tem foto), a grade "Fotos do imóvel" com "Adicionar foto"
  e "Continuar". O roteiro NÃO é um formulário novo: lê as fotos de cômodo que o avaliador já envia.
  Roda: node --test src/lib/vistoria/e1079-visita-avaliador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROTEIRO_DA_VISITA, ROTULO_ADICIONAR_FOTO, ROTULO_CONTINUAR, TITULO_FOTOS_VISITA, TITULO_ROTEIRO, TITULO_VISITA, roteiroDaVisita, vagasDeFoto } from "./visita-avaliador.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("os textos do desenho", () => {
  assert.equal(TITULO_VISITA, "Visita em andamento");
  assert.equal(TITULO_ROTEIRO, "Roteiro da visita");
  assert.equal(TITULO_FOTOS_VISITA, "Fotos do imóvel");
  assert.equal(ROTULO_ADICIONAR_FOTO, "Adicionar foto");
  assert.equal(ROTULO_CONTINUAR, "Continuar");
  assert.deepEqual(ROTEIRO_DA_VISITA.map((r) => r.rotulo), ["Fotos da fachada", "Sala", "Cozinha", "Quartos", "Banheiros"]);
});

test("roteiro: cada linha fica marcada quando já há foto desse cômodo (o nome é o que o avaliador escreveu)", () => {
  const r = roteiroDaVisita(["Fachada do prédio", "sala de estar", null, "  "]);
  assert.deepEqual(r, [
    { id: "fachada", rotulo: "Fotos da fachada", feito: true },
    { id: "sala", rotulo: "Sala", feito: true },
    { id: "cozinha", rotulo: "Cozinha", feito: false },
    { id: "quartos", rotulo: "Quartos", feito: false },
    { id: "banheiros", rotulo: "Banheiros", feito: false },
  ]);
  // Acentos, maiúsculas e variações do dia a dia.
  const tudo = roteiroDaVisita(["FACHADA", "Sala", "COZINHA americana", "Quarto principal", "Suíte", "Lavabo"]);
  assert.deepEqual(tudo.map((x) => x.feito), [true, true, true, true, true]);
  assert.deepEqual(roteiroDaVisita([]).map((x) => x.feito), [false, false, false, false, false]);
  // "Sala" não se confunde com outras palavras que a contêm por acaso; foto de item não conforme (sem cômodo) não conta.
  assert.equal(roteiroDaVisita(["salão de festas do prédio"])[1].feito, false);
  assert.equal(roteiroDaVisita(["varanda"]).some((x) => x.feito), false);
});

test("grade de fotos: as vagas 'Adicionar foto' completam a linha de 3; linha cheia abre uma linha nova", () => {
  assert.equal(vagasDeFoto(0), 3);
  assert.equal(vagasDeFoto(1), 2);
  assert.equal(vagasDeFoto(2), 1);
  assert.equal(vagasDeFoto(3), 3);
  assert.equal(vagasDeFoto(4), 2);
});

test("a página: durante a visita abre com o bloco do desenho e mantém o checklist, o envio de foto e o concluir", () => {
  const p = ler("app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx");
  assert.match(p, /emAndamento \? TITULO_VISITA :/);
  assert.match(p, /<VisitaEmAndamento\s/);
  assert.ok(p.indexOf("<VisitaEmAndamento") < p.indexOf("<ChecklistAvaliador"), "o bloco da visita vem antes do checklist");
  assert.match(p, /roteiro=\{roteiroDaVisita\(fotosLista\.map\(\(f\) => f\.comodo\)\)\}/);
  // O que já existia continua: o campo "Cômodo" livre, o envio e o concluir.
  assert.match(p, /<input name="comodo"/);
  assert.match(p, /data-testid="avaliacao-fotos"/);
  assert.match(p, /testid="concluir-visita"/);
  assert.match(p, /id="enviar-foto"/);
  assert.match(p, /id="itens"/);
});

test("o componente: só apresentação; estilos do desenho no arquivo de exceção; a foto do imóvel nunca é obrigatória", () => {
  const c = ler("components/avaliadores/visita.tsx");
  assert.match(c, /from "@\/lib\/conta\/visual-mockup"/);
  assert.doesNotMatch(c, /bg-\[#|text-\[#|shadow-\[|border-\[#/);
  assert.match(c, /capaUrl \?/, "sem foto do anúncio, o bloco não deixa um buraco");
  assert.match(c, /href="#enviar-foto"/);
  assert.match(c, /href="#itens"/);
  assert.match(ler("lib/conta/visual-mockup.ts"), /Visita do avaliador \(E1079, fatia 4\)/);
});
