/* E679 — painel Avaliações unificado (mockup avaliacoes-painel). Roda: node --test src/lib/conta/painel-avaliacoes.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { abaDoPainel, dataLonga, diasRestantes, paraAvaliarDe, rotuloAba, rotuloFaltam, TEXTO_SIGILO } from "./painel-avaliacoes.ts";

const AGORA = new Date("2026-11-11T12:00:00Z");

test("as três abas do mockup e o padrão é 'Para avaliar'", () => {
  assert.equal(abaDoPainel(undefined), "para-avaliar");
  assert.equal(abaDoPainel("recebidas"), "recebidas");
  assert.equal(abaDoPainel("feitas"), "feitas");
  assert.equal(abaDoPainel("lixo"), "para-avaliar");
});

test("os filtros antigos da tela da Conta (todas, recentes, positivas) caem em 'Recebidas'", () => {
  for (const a of ["todas", "recentes", "positivas"]) assert.equal(abaDoPainel(a), "recebidas");
});

test("rótulo da aba: 'Para avaliar (2)' só com pendência", () => {
  assert.equal(rotuloAba("para-avaliar", 2), "Para avaliar (2)");
  assert.equal(rotuloAba("para-avaliar", 0), "Para avaliar");
  assert.equal(rotuloAba("recebidas", 5), "Recebidas");
  assert.equal(rotuloAba("feitas", 5), "Feitas");
});

test("prazo: 14 dias depois do fim do contrato (contrato encerrado em 10/11 → faltam 13 em 11/11)", () => {
  assert.equal(diasRestantes("2026-11-10T00:00:00Z", AGORA), 13);
  assert.equal(diasRestantes("2026-11-01T12:00:00Z", AGORA), 4);
  assert.equal(diasRestantes("2026-10-20T00:00:00Z", AGORA), 0);
  assert.equal(diasRestantes(null, AGORA), null);
});

test("'Faltam N dias' no singular e no último dia", () => {
  assert.equal(rotuloFaltam(9), "Faltam 9 dias");
  assert.equal(rotuloFaltam(1), "Falta 1 dia");
  assert.equal(rotuloFaltam(0), "Último dia");
});

test("data por extenso, como no mockup: '10 de novembro'", () => {
  assert.equal(dataLonga("2026-11-10T03:00:00Z"), "10 de novembro");
  assert.equal(dataLonga("2026-01-02T12:00:00Z"), "2 de janeiro");
  assert.equal(dataLonga(null), "");
});

test("o aviso de sigilo é o do mockup e não promete data fora dos 14 dias", () => {
  assert.equal(TEXTO_SIGILO, "As avaliações são secretas: publicam quando os dois lados avaliarem, ou ao fim dos 14 dias.");
});

test("'Para avaliar': só janela aberta, sem avaliação minha, morador e dono juntos, o que vence antes primeiro", () => {
  const lista = paraAvaliarDe({
    locacoes: [
      { id: "l1", propertyTitle: "Apartamento A", podeAvaliar: true, encerradoEm: "2026-11-10T00:00:00Z" },
      { id: "l2", propertyTitle: "Casa B", podeAvaliar: false, encerradoEm: null },
      { id: "l3", propertyTitle: "Casa C", podeAvaliar: true, encerradoEm: "2026-11-02T00:00:00Z" },
    ],
    contratos: [{ id: "c1", propertyTitle: "Studio D", podeAvaliar: true, encerradoEm: "2026-11-05T00:00:00Z" }],
    jaAvaliados: new Set(["c1"]),
    agora: AGORA,
  });
  assert.deepEqual(lista.map((x) => [x.contratoId, x.papel, x.dias]), [["l3", "morador", 5], ["l1", "morador", 13]]);
});

test("'há N dias' e o estado da avaliação que eu fiz", async () => {
  const { haDias, rotuloStatusFeita } = await import("./painel-avaliacoes.ts");
  assert.equal(haDias("2026-11-11T08:00:00Z", AGORA), "hoje");
  assert.equal(haDias("2026-11-10T08:00:00Z", AGORA), "ontem");
  assert.equal(haDias("2026-11-09T08:00:00Z", AGORA), "há 2 dias");
  assert.equal(haDias(null, AGORA), "");
  assert.equal(rotuloStatusFeita("enviada"), "Aguardando a outra parte");
  assert.equal(rotuloStatusFeita("publicada"), "Publicada");
  assert.equal(rotuloStatusFeita("em_moderacao"), "Em análise pela equipe");
  assert.doesNotMatch(rotuloStatusFeita("enviada"), /já enviou|recebeu/i);
});

test("E679/E85: um só painel — a rota antiga redireciona e os dois menus apontam para o mesmo destino", async () => {
  const { readFileSync } = await import("node:fs");
  const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  assert.match(ler("app/(dashboard)/dashboard/conta/avaliacoes/page.tsx"), /redirect\(`\/dashboard\/avaliacoes\?aba=recebidas/);
  assert.match(ler("config/menu-por-papel.ts"), /rotulo: "Avaliações", icone: "conta", href: "\/dashboard\/avaliacoes"/);
  const secoes = ler("lib/conta/secoes.ts");
  assert.doesNotMatch(secoes, /conta\/avaliacoes/);
  assert.match(secoes, /rotulo: "Avaliações", href: "\/dashboard\/avaliacoes"/);
});

test("E679: o painel tem as três abas do mockup, o aviso de sigilo, 'Recebidas recentes' e 'Avaliar agora'", async () => {
  const { readFileSync } = await import("node:fs");
  const t = readFileSync(new URL("../../components/avaliacoes/painel.tsx", import.meta.url), "utf8");
  for (const id of ["painel-aba-", "painel-para-avaliar", "painel-sigilo", "painel-recebida-recente", "painel-avaliar-agora", "painel-feitas", "painel-prazo"]) assert.match(t, new RegExp(id), id);
  assert.match(t, /Recebidas recentes/);
  assert.match(t, /TEXTO_SIGILO/);
  assert.doesNotMatch(t, /anfitri|inquilin|h[oó]spede/i);
});

// E782 (adendo): "Uberlandia" (digitado sem acento no perfil) aparece "Uberlândia" nos dois cartões e no chip da tela de papéis.
import { linhaQueroMorar, resumoQueroMorar, textoQueroAnunciar } from "./tela-papeis.ts";
import { grafiaDaCidade } from "../cidades.ts";
test("E782 adendo: a cidade sem acento sai com a grafia oficial nos três textos dos papéis", () => {
  assert.equal(grafiaDaCidade("Uberlandia"), "Uberlândia");
  assert.equal(grafiaDaCidade("  uberlandia "), "Uberlândia");
  assert.equal(grafiaDaCidade("Araguari"), "Araguari");
  assert.equal(linhaQueroMorar("Uberlandia"), "Procurando imóvel de 1 a 6 meses em Uberlândia");
  assert.equal(resumoQueroMorar("Uberlandia"), "Uberlândia · 1–6 meses · Mobiliado");
  assert.match(textoQueroAnunciar("Uberlandia"), /em Uberlândia\.$/);
});
