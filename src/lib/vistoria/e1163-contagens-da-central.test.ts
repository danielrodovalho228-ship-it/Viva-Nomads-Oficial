import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { separarContasDeTeste, textoDasContasDeTeste } from "./contagens-da-central.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

/*
  E1163 (ORDENS-DUET 684 e 685). As três filas da avaliação que esperam a equipe — pedido sem avaliador elegível, laudo
  atrasado, credenciamento para decidir — passam a contar no "Para decidir" da Central, pela MESMA conta da página dos
  avaliadores. A regra pura da conta: as contas de teste ficam à parte (fora do número) e o detalhe é o mais antigo dos
  que contam.
  Roda: node --test src/lib/vistoria/e1163-contagens-da-central.test.ts
*/
type Linha = { id: string; dono: string | null; desde: string | null };
const TESTE = new Set(["conta-teste-1", "conta-teste-2"]);
const contar = (linhas: Linha[]) => separarContasDeTeste(linhas, (l) => l.dono, (l) => l.desde, TESTE);

test("E1163: as contas de teste saem do número e ficam à parte", () => {
  const r = contar([
    { id: "a", dono: "dona-real", desde: "2026-11-20T10:00:00Z" },
    { id: "b", dono: "conta-teste-1", desde: "2026-11-01T10:00:00Z" },
    { id: "c", dono: "dono-real-2", desde: "2026-11-22T10:00:00Z" },
    { id: "d", dono: "conta-teste-2", desde: "2026-11-23T10:00:00Z" },
  ]);
  assert.equal(r.n, 2, "só os dois de conta real contam");
  assert.deepEqual(r.reais.map((l) => l.id), ["a", "c"]);
  assert.deepEqual(r.deTeste.map((l) => l.id), ["b", "d"]);
  assert.equal(r.n, r.reais.length, "número = lista");
});

test("E1163: o detalhe é o mais antigo dos que contam — nunca o de uma conta de teste", () => {
  const r = contar([
    { id: "novo", dono: "dona-real", desde: "2026-11-22T10:00:00Z" },
    { id: "antigo", dono: "dono-real-2", desde: "2025-03-01T10:00:00Z" },
    { id: "teste-mais-antigo", dono: "conta-teste-1", desde: "2024-01-01T10:00:00Z" },
  ]);
  assert.equal(r.maisAntigoEm, "2025-03-01T10:00:00Z");
  // A ordem de chegada das linhas não importa.
  assert.equal(contar([...r.reais].reverse()).maisAntigoEm, "2025-03-01T10:00:00Z");
});

test("E1163: nada a contar dá zero, sem detalhe; só contas de teste também", () => {
  assert.deepEqual(contar([]), { n: 0, maisAntigoEm: null, reais: [], deTeste: [] });
  const soTeste = contar([{ id: "t", dono: "conta-teste-1", desde: "2026-11-01T10:00:00Z" }]);
  assert.equal(soTeste.n, 0);
  assert.equal(soTeste.maisAntigoEm, null);
  assert.equal(soTeste.deTeste.length, 1);
});

test("E1163: linha sem conta conhecida conta como real (não some); linha sem data conta, sem entrar no detalhe", () => {
  const r = contar([
    { id: "sem-dono", dono: null, desde: "2026-11-10T10:00:00Z" },
    { id: "sem-data", dono: "dona-real", desde: null },
  ]);
  assert.equal(r.n, 2);
  assert.equal(r.maisAntigoEm, "2026-11-10T10:00:00Z");
});

test("E1163: o texto por cima das linhas de conta de teste é o aprovado (ORDEM-706), igual para qualquer N", () => {
  assert.equal(textoDasContasDeTeste(1), "Mais 1 de conta de teste, fora do número:");
  assert.equal(textoDasContasDeTeste(3), "Mais 3 de conta de teste, fora do número:");
});

/*
  A varredura: as duas telas leem as três filas do MESMO módulo, e nenhuma conta à mão.
  As duas contas erradas da página (o pedido parado atrás dos 50 mais recentes; o atraso refeito pelo relógio) não voltam.
*/
const ler = (p: string) => semComentarios(readFileSync(p, "utf8"));
const MODULO = ler("src/lib/data/avaliadores-contagens.ts");
const PAGINA = ler("src/app/(dashboard)/admin/avaliadores/page.tsx");
const CENTRAL = ler("src/lib/data/admin-decisoes.ts");
const TRES = ["pedidosSemAvaliador", "laudosAtrasados", "credenciamentosADecidir"];

test("E1163 (varredura): o módulo lê da mais antiga para a mais nova, e leitura falhada é null — nunca zero", () => {
  // E1175: a quarta leitura (os pedidos que esperam o morador) segue a mesma regra.
  assert.equal((MODULO.match(/\.order\("[a-z_]+", \{ ascending: true \}\)/g) ?? []).length, 4, "as quatro leituras, da mais antiga");
  assert.doesNotMatch(MODULO, /ascending: false/, "nenhuma leitura 'das mais recentes': o teto nunca corta a que espera há mais tempo");
  assert.equal((MODULO.match(/if \(error\) return null;/g) ?? []).length, 4, "cada leitura falhada devolve null");
  // O laudo atrasado é o que a ROTINA gravou; o módulo não tem um segundo relógio.
  assert.match(MODULO, /\.not\("laudo_atrasado_em", "is", null\)/);
  assert.doesNotMatch(MODULO, /laudoAtrasado\(|new Date\(|Date\.now\(/);
  // O pedido sem avaliador segue o critério da rotina que tenta de novo.
  assert.match(MODULO, /\.eq\("status", "pedido"\)\s*\.eq\("aguardando_avaliador", true\)/);
});

test("E1163 (varredura): a Central e a página dos avaliadores leem as três filas do mesmo módulo", () => {
  for (const f of TRES) {
    assert.match(PAGINA, new RegExp(`${f}\\(admin, contasDeTesteDaCentral\\)`), `a página lê ${f} do módulo`);
    assert.match(CENTRAL, new RegExp(`${f}\\(admin, teste\\)`), `a Central lê ${f} do módulo`);
  }
  assert.match(PAGINA, /from "@\/lib\/data\/avaliadores-contagens"/);
  assert.match(CENTRAL, /from "\.\/avaliadores-contagens"|from "@\/lib\/data\/avaliadores-contagens"/);
  // As duas usam a mesma lista de contas de teste.
  assert.match(PAGINA, /const contasDeTesteDaCentral = await idsContasTeste\(admin\);/);
  assert.match(CENTRAL, /const teste = await idsContasTeste\(admin\);/);
});

test("E1163 (varredura): a página não conta à mão — número e lista saem da leitura do módulo", () => {
  assert.match(PAGINA, /const semAvaliador = filaSemAvaliador\.reais;/);
  assert.match(PAGINA, /const atrasadosLista = filaAtrasados\.reais;/);
  assert.match(PAGINA, /contagemDecisoes\(\{ credenciamentos: aDecidirReais, semAvaliador: semAvaliador\.length,/);
  assert.match(PAGINA, /laudosAtrasados: atrasadosLista\.length/);
  // As duas contas erradas não voltam: o filtro sobre os 50 mais recentes e o atraso refeito pelo relógio.
  assert.doesNotMatch(PAGINA, /\.filter\(\(x\) => x\.aguardando_avaliador/);
  assert.doesNotMatch(PAGINA, /laudoAtrasado\(/);
  assert.doesNotMatch(PAGINA, /import \{[^}]*\blaudoAtrasado\b[^}]*\} from "@\/lib\/vistoria\/laudo"/);
  // Leitura falhada sobe: a página nunca mostra zero no lugar de uma fila que não leu.
  assert.match(PAGINA, /if \(!filaSemAvaliador \|\| !filaAtrasados \|\| !filaCredenciamentos \|\| !filaEsperaDoMorador\) throw new Error\(/);
  // As contas de teste ficam à parte nas três filas, com o texto da fonte — e, pela ORDEM-DUET-735, também na secção
  // das propostas expiradas ou descartadas (E1159) e, pela ORDEM-DUET-738, na lista das recusas (E1169): cinco blocos,
  // o mesmo texto. E pela ORDEM-DUET-782 (E1175), nos pedidos que esperam o morador: seis blocos.
  assert.equal((PAGINA.match(/textoDasContasDeTeste\(/g) ?? []).length, 6);
  assert.match(PAGINA, /const aDecidirReais = aDecidir\.filter\(\(c\) => !credenciamentosDeTeste\.has\(c\.id\)\);/);
});

test("E1163 (varredura): a Central não refaz nenhuma das três contas por conta própria", () => {
  assert.doesNotMatch(CENTRAL, /aguardando_avaliador|laudo_atrasado_em/);
  assert.doesNotMatch(CENTRAL, /from\("avaliadores_credenciamento"\)/);
});
