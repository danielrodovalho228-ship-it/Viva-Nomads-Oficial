/*
  E1079/E1080 (ORDEM-DUET-385/386, condições do coordenador DUET-1455): a base dos cartões do avaliador.
  Roda: node --test src/lib/vistoria/e1080-vitrine-avaliadores.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VITRINE_AVALIADORES_ABERTA, cartoesDaCidade, fotoPublicaPermitida, rostoDoAvaliador, type FonteAvaliador } from "./vitrine-avaliadores.ts";

const f = (o: Partial<FonteAvaliador>): FonteAvaliador => ({
  numero: "UDI-001",
  nome: "Ana Souza",
  cidade: "Uberlândia",
  selo: null,
  avaliacoesFeitas: 0,
  notaConduta: null,
  contaTeste: true,
  fotoUrl: null,
  ...o,
});

test("E1080: a listagem pública por cidade nasce desligada (só piloto, até o Daniel abrir)", () => {
  assert.equal(VITRINE_AVALIADORES_ABERTA, false);
});

test("E1080 (386): foto quando há e pode; senão iniciais — nunca vazio nem '?'; conta real não mostra foto sem o Daniel", () => {
  assert.deepEqual(rostoDoAvaliador("Ana Souza", "https://x/foto.webp", true), { tipo: "foto", url: "https://x/foto.webp" });
  assert.deepEqual(rostoDoAvaliador("Ana Souza", null, true), { tipo: "iniciais", texto: "AS" });
  assert.deepEqual(rostoDoAvaliador("Rogério Silva", "https://x/r.webp", false), { tipo: "iniciais", texto: "RS" }, "conta real: sem foto pública por agora");
  assert.deepEqual(rostoDoAvaliador("", null, true), { tipo: "iniciais", texto: "AV" });
  assert.equal(fotoPublicaPermitida(false), false);
  assert.equal(fotoPublicaPermitida(true), true);
});

test("E1080: os cartões da cidade — várias cidades contam, número único (o primeiro vence), mais avaliações primeiro", () => {
  const fontes = [
    f({ numero: "UDI-001", nome: "Bruno", avaliacoesFeitas: 2 }),
    f({ numero: "UBE-001", nome: "Rogério Silva", cidade: "Uberlandia, Araguari, Ituiutaba", contaTeste: false }),
    f({ numero: "UDI-001", nome: "Duplicado", avaliacoesFeitas: 9 }),
    f({ numero: "UBA-001", nome: "Carla", cidade: "Uberaba", avaliacoesFeitas: 5 }),
  ];
  const c = cartoesDaCidade(fontes, "Araguari");
  assert.deepEqual(c.map((x) => x.numero), ["UBE-001"]);
  const u = cartoesDaCidade(fontes, "Uberlândia");
  assert.deepEqual(u.map((x) => [x.numero, x.nome]), [["UDI-001", "Bruno"], ["UBE-001", "Rogério Silva"]]);
  assert.equal(u[0].href, "/avaliadores/UDI-001");
  assert.deepEqual(cartoesDaCidade([], "Uberlândia"), []);
});

test("E1080: nada na base diz 'credenciado com o CNPJ da Viva' nem guarda telefone ou e-mail", () => {
  const s = readFileSync("src/lib/vistoria/vitrine-avaliadores.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(s, /CNPJ da Viva|telefone|phone|e-?mail|whats/i);
});

import { linhaDaCidade, novoNaViva, quadroDePreco, reaisCurtos, ufDaCidade } from "./vitrine-avaliadores.ts";

test("E1079 (397): o quadro de preço é o da TABELA DA CIDADE, por porte, com os rótulos do desenho", () => {
  const linha = (cidade: string, porte: "estudio" | "q1_2" | "q3_mais", valor: number) => ({ cidade, porte, valor, incluiTexto: null, vigenteDesde: "2026-11-01T00:00:00Z" });
  const tabela = [linha("Uberlandia", "estudio", 150), linha("Uberlandia", "q1_2", 250), linha("Uberlandia", "q3_mais", 350), linha("Uberaba", "q1_2", 999)];
  const q = quadroDePreco(tabela, "Uberlândia", new Date("2026-11-22T00:00:00Z"));
  assert.deepEqual(q.map((l) => [l.rotulo, reaisCurtos(l.valor)]), [["Estúdio", "R$ 150"], ["1–2 quartos", "R$ 250"], ["3+ quartos", "R$ 350"]]);
  assert.deepEqual(quadroDePreco(tabela, "Araguari", new Date("2026-11-22T00:00:00Z")), [], "sem tabela na cidade, sem quadro");
  assert.equal(reaisCurtos(150.5), "R$ 150,50");
});

test("E1079: a UF só quando a cidade é única no IBGE; 'Novo na Viva' só sem avaliações nem nota", () => {
  const ibge = { MG: ["Uberlândia", "Santa Luzia"], PB: ["Santa Luzia"] };
  assert.equal(ufDaCidade(ibge, "Uberlandia"), "MG");
  assert.equal(ufDaCidade(ibge, "Santa Luzia"), null);
  assert.equal(linhaDaCidade("Uberlândia", "MG"), "Uberlândia • MG");
  assert.equal(novoNaViva(0, null), true);
  assert.equal(novoNaViva(2, null), false);
  assert.equal(novoNaViva(0, 4.5), false);
});
