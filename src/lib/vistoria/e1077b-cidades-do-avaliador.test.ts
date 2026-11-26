/*
  E1077-b2 (ORDEM-DUET-378/379): o credenciamento com várias cidades. O campo `cidade` do credenciamento guarda o texto
  como o avaliador escreveu ("Uberlandia, Araguari, Ituiutaba"); o rodízio comparava o texto inteiro com a cidade do
  imóvel e nunca casava. cidadesDoAvaliador(texto) divide por vírgula, ponto e vírgula ou " e " e normaliza cada
  cidade com chaveCidade; atendeCidade(...) é a única comparação avaliador × imóvel. Os dados gravados não mudam.
  Roda: node --test src/lib/vistoria/e1077b-cidades-do-avaliador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { atendeCidade, cidadesDoAvaliador, impedimento, siglaCidade, type AvaliadorFila, type PedidoParaDesignar } from "./regras.ts";
import { filaDeRodizio } from "./telas-exibicao.ts";

const VARIAS = "Uberlandia, Araguari, Ituiutaba";

test("E1077-b2: cidadesDoAvaliador divide por vírgula, ponto e vírgula ou ' e ' e normaliza cada cidade", () => {
  assert.deepEqual(cidadesDoAvaliador(VARIAS), ["uberlandia", "araguari", "ituiutaba"]);
  assert.deepEqual(cidadesDoAvaliador("Uberlândia; Araguari e Ituiutaba"), ["uberlandia", "araguari", "ituiutaba"]);
  assert.deepEqual(cidadesDoAvaliador("Uberlândia E Araguari"), ["uberlandia", "araguari"]);
  assert.deepEqual(cidadesDoAvaliador("Uberlândia"), ["uberlandia"]);
  assert.deepEqual(cidadesDoAvaliador("  Uberlândia , , uberlandia "), ["uberlandia"], "vazios e repetidas saem");
  assert.deepEqual(cidadesDoAvaliador(""), []);
  assert.deepEqual(cidadesDoAvaliador(null), []);
});

test("E1077-b2: 'Uberlandia, Araguari, Ituiutaba' atende Uberlândia e Araguari e não atende Uberaba; uma cidade só continua igual", () => {
  assert.equal(atendeCidade(VARIAS, "Uberlândia"), true);
  assert.equal(atendeCidade(VARIAS, "Araguari"), true);
  assert.equal(atendeCidade(VARIAS, "Ituiutaba"), true);
  assert.equal(atendeCidade(VARIAS, "Uberaba"), false);
  assert.equal(atendeCidade("Uberlândia", "Uberlandia"), true);
  assert.equal(atendeCidade("Uberlândia", "Uberaba"), false);
  assert.equal(atendeCidade("", "Uberlândia"), false);
  assert.equal(atendeCidade("Uberlândia", ""), false);
});

const av = (cidade: string): AvaliadorFila => ({
  id: `a-${cidade}`,
  userId: `u-${cidade}`,
  cidade,
  status: "ativo",
  teste: false,
  credenciadoEm: "2026-11-01T00:00:00Z",
  ultimaDesignacaoEm: null,
  relacoesDonos: [],
  relacoesImoveis: [],
});
const pedido = (cidade: string): PedidoParaDesignar => ({ id: "p", propertyId: "i", ownerId: "d", cidade, tipo: "inicial", teste: false, primeiroAvaliadorId: null, jaDesignados: [] });
const semHistorico = { servicosAoDono: [], avaliacoesDoImovel: [] };
const agora = new Date("2026-11-21T12:00:00Z");

test("E1077-b2: o rodízio (impedimento outra_cidade e a fila da cidade no admin) usa as várias cidades", () => {
  const varias = av(VARIAS);
  assert.equal(impedimento(varias, pedido("Araguari"), semHistorico, agora), null);
  assert.equal(impedimento(varias, pedido("Uberlândia"), semHistorico, agora), null);
  assert.equal(impedimento(varias, pedido("Uberaba"), semHistorico, agora), "outra_cidade");
  // Uma cidade só: como antes.
  assert.equal(impedimento(av("Uberlândia"), pedido("Uberlandia"), semHistorico, agora), null);
  assert.equal(impedimento(av("Uberlândia"), pedido("Araguari"), semHistorico, agora), "outra_cidade");
  const fila = [varias, av("Uberaba")];
  assert.deepEqual(filaDeRodizio(fila, "Araguari", agora).map((x) => x.id), [varias.id]);
  assert.deepEqual(filaDeRodizio(fila, "Uberaba", agora).map((x) => x.id), ["a-Uberaba"]);
});

test("E1077-b2: o número novo usa a sigla da 1ª cidade (uma cidade só continua igual)", () => {
  assert.equal(siglaCidade(VARIAS), "UDI");
  assert.equal(siglaCidade("Araguari e Uberlândia"), "ARG");
  assert.equal(siglaCidade("Uberlândia"), "UDI");
});

test("E1077-b2: a Central conta e lista cada cidade do avaliador; ninguém mais compara o texto inteiro", () => {
  const pagina = readFileSync("src/app/(dashboard)/admin/avaliadores/page.tsx", "utf8");
  assert.match(pagina, /atendeCidade\(c\.cidade, cidade\)/);
  assert.match(pagina, /partesDaCidade\(c\.cidade\)/);
  for (const f of ["src/lib/vistoria/regras.ts", "src/lib/vistoria/telas-exibicao.ts", "src/app/(dashboard)/admin/avaliadores/page.tsx"]) {
    assert.doesNotMatch(readFileSync(f, "utf8"), /chaveCidade\((a|c)\.cidade\) [!=]== chaveCidade/, `${f}: comparação do texto inteiro`);
  }
});
