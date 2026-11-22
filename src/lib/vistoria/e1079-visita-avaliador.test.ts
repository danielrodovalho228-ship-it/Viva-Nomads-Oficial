/*
  E1079 (ORDEM-DUET-385), fatia 4 — a visita do avaliador pelo mockup aprovado (avaliador-visita): "Visita em andamento",
  a foto do imóvel, o "Roteiro da visita" (marcado pelo que já tem foto), a grade "Fotos do imóvel" com "Adicionar foto"
  e "Continuar". O roteiro NÃO é um formulário novo: lê as fotos de cômodo que o avaliador já envia.
  Roda: node --test src/lib/vistoria/e1079-visita-avaliador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROTEIRO_DA_VISITA, ROTULO_ADICIONAR_FOTO, ROTULO_CONTINUAR, TITULO_FOTOS_VISITA, TITULO_ROTEIRO, TITULO_VISITA, TITULO_VISITA_AGENDADA, faltasDoRoteiro, msgRoteiroIncompleto, roteiroDaVisita, tituloDaVisita, vagasDeFoto, visitaEmAndamento } from "./visita-avaliador.ts";

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
  assert.match(p, /agendada \? tituloDaVisita\(emAndamento\) :/);
  assert.match(p, /\{agendada && <VisitaEmAndamento\s/);
  assert.ok(p.indexOf("<VisitaEmAndamento") < p.indexOf("<ChecklistAvaliador"), "o bloco da visita vem antes do checklist");
  assert.match(p, /const roteiro = roteiroDaVisita\(fotosLista\.map\(\(f\) => f\.comodo\)\);/);
  assert.match(p, /roteiro=\{roteiro\}/);
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

test("ORDEM-431, resposta 2: 'Visita em andamento' só a partir do DIA marcado (Brasília); antes, 'Visita agendada'", () => {
  const agora = new Date("2026-11-22T15:00:00Z"); // 12:00 de 22/11 em Brasília
  assert.equal(visitaEmAndamento("agendado", "2026-11-22T20:00:00Z", agora), true, "no dia, mesmo antes da hora");
  assert.equal(visitaEmAndamento("agendado", "2026-11-20T12:00:00Z", agora), true, "dia já passado e ainda por concluir");
  assert.equal(visitaEmAndamento("agendado", "2026-11-23T12:00:00Z", agora), false, "amanhã: ainda só agendada");
  // 23/11 01:00 UTC são 22:00 de 22/11 em Brasília: lá ainda é o dia marcado.
  assert.equal(visitaEmAndamento("agendado", "2026-11-23T01:00:00Z", agora), true);
  // 23/11 04:00 UTC já é 23/11 em Brasília.
  assert.equal(visitaEmAndamento("agendado", "2026-11-23T04:00:00Z", agora), false);
  assert.equal(visitaEmAndamento("agendado", null, agora), false, "sem data marcada não há 'em andamento'");
  assert.equal(visitaEmAndamento("realizada", "2026-11-22T12:00:00Z", agora), false);
  assert.equal(TITULO_VISITA_AGENDADA, "Visita agendada");
  assert.equal(tituloDaVisita(true), TITULO_VISITA);
  assert.equal(tituloDaVisita(false), TITULO_VISITA_AGENDADA);
  // Não há botão "Iniciar visita" nem estado novo: a etiqueta acompanha o dia (ORDEM-DUET-435).
  const p = ler("app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx");
  assert.match(p, /const emAndamento = visitaEmAndamento\(p\.status as string, p\.agendado_para as string \| null, new Date\(\)\);/);
  assert.doesNotMatch(p, /Iniciar visita/);
});

test("ORDEM-431, resposta 1: o roteiro TRAVA 'Concluir a visita' — sem a foto de um ambiente não conclui, e diz qual falta", () => {
  assert.deepEqual(faltasDoRoteiro(roteiroDaVisita(["Fachada", "Sala de estar"])), ["Cozinha", "Quartos", "Banheiros"]);
  assert.deepEqual(faltasDoRoteiro(roteiroDaVisita([])), ["Fachada", "Sala", "Cozinha", "Quartos", "Banheiros"]);
  assert.deepEqual(faltasDoRoteiro(roteiroDaVisita(["fachada", "sala", "cozinha", "quarto 1", "banheiro social"])), []);
  assert.equal(msgRoteiroIncompleto(["Cozinha", "Quartos", "Banheiros"]), "Para concluir a visita, falta a foto de: Cozinha, Quartos e Banheiros. Envie uma foto de cada ambiente do roteiro.");
  assert.equal(msgRoteiroIncompleto(["Cozinha"]), "Para concluir a visita, falta a foto de: Cozinha. Envie uma foto de cada ambiente do roteiro.");
  // O servidor recusa ANTES de mudar o estado da avaliação, pelas fotos de cômodo gravadas.
  const a = ler("lib/vistoria/laudo-actions.ts");
  const f = a.slice(a.indexOf("export async function concluirVisita"), a.indexOf("export async function enviarLaudo"));
  assert.match(f, /from\("vistoria_checklist_fotos"\)\.select\("comodo"\)\.eq\("pedido_id", c\.p\.id\)/);
  assert.match(f, /const faltas = faltasDoRoteiro\(roteiroDaVisita\(/);
  assert.match(f, /if \(faltas\.length\) return \{ ok: false, erro: msgRoteiroIncompleto\(faltas\) \};/);
  assert.ok(f.indexOf("if (faltas.length)") < f.indexOf('update({ status: "realizada"'), "a recusa vem antes de concluir");
  assert.match(f, /if \(erroFotos\) return/, "sem ler as fotos, não conclui");
  // A tela diz o que falta junto do botão, antes do clique.
  const p = ler("app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx");
  assert.match(p, /data-testid="concluir-faltas"/);
  assert.match(p, /msgRoteiroIncompleto\(faltasRoteiro\)/);
});
