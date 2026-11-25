import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aEsperaDaConcordancia, concordanciaRecusada, type EstadoDaConcordancia } from "./concordancia.ts";
import { TEXTO_ESPERA_DO_MORADOR, TEXTO_RECUSADO_PELO_MORADOR, TITULO_ESPERA_DO_MORADOR, VAZIO_ESPERA_DO_MORADOR, linhaEsperaDoMorador } from "./contagens-da-central.ts";
import { DECISOES_ADMIN, montarDecisoesAdmin } from "../admin/decisoes-admin.ts";
import { fonteSemComentarios } from "../fonte-sem-comentarios.ts";

/*
  E1175 (ORDENS-DUET 752, 776, 780 e 782). A Central conta os pedidos de avaliação do imóvel ocupado que esperam o
  morador: os que têm data proposta à espera da concordância, e — como SEGUNDO ESTADO da mesma linha — os recusados
  pelo morador, à espera de nova data. Os dois estados têm cada um a sua regra pura, e um pedido nunca está nos dois.
  A trava de tela é a t1777 (ORDEM-DUET-793: a t1775 ficou com o E1179).
  Roda: node --test src/lib/vistoria/e1175-espera-da-moradora-na-central.test.ts
*/
const base: EstadoDaConcordancia = { status: "designado", ocupado: true, agendadoPara: "2026-11-27T13:00:00Z", concordanciaPedidaEm: "2026-11-24T12:00:00Z", concordanciaEm: null };
const casos: Record<string, EstadoDaConcordancia> = {
  aEspera: base,
  recusado: { ...base, agendadoPara: null },
  concordado: { ...base, status: "agendado", concordanciaEm: "2026-11-24T13:00:00Z" },
  vago: { ...base, ocupado: false },
  semAvaliador: { ...base, status: "pedido", agendadoPara: null },
  nuncaPediu: { ...base, agendadoPara: null, concordanciaPedidaEm: null },
};

test("E1175: a espera da concordância — designado, ocupado, com data e sem concordância", () => {
  assert.equal(aEsperaDaConcordancia(casos.aEspera), true);
  for (const k of ["recusado", "concordado", "vago", "semAvaliador", "nuncaPediu"]) assert.equal(aEsperaDaConcordancia(casos[k]), false, k);
});

test("E1175: um pedido nunca está nos dois estados", () => {
  for (const [k, p] of Object.entries(casos)) assert.ok(!(aEsperaDaConcordancia(p) && concordanciaRecusada(p)), k);
  assert.equal(concordanciaRecusada(casos.recusado), true);
});

test("E1175: a linha soma os dois estados e diz cada um, no singular e no plural", () => {
  const zero = { n: 0, maisAntigoEm: null };
  assert.equal(linhaEsperaDoMorador(zero, zero).n, 0);
  const so1 = linhaEsperaDoMorador({ n: 1, maisAntigoEm: "2026-11-24T12:00:00Z" }, zero);
  assert.equal(so1.n, 1);
  assert.equal(so1.texto, `1 ${TEXTO_ESPERA_DO_MORADOR.um}`);
  const soRecusados = linhaEsperaDoMorador(zero, { n: 2, maisAntigoEm: "2026-11-23T12:00:00Z" });
  assert.equal(soRecusados.texto, `2 ${TEXTO_RECUSADO_PELO_MORADOR.varios}`);
  assert.doesNotMatch(soRecusados.texto, /concordância/, "só recusados: a linha não diz 'à espera da concordância'");
  const os2 = linhaEsperaDoMorador({ n: 3, maisAntigoEm: "2026-11-24T12:00:00Z" }, { n: 1, maisAntigoEm: "2026-11-22T12:00:00Z" });
  assert.equal(os2.n, 4);
  assert.equal(os2.texto, `3 ${TEXTO_ESPERA_DO_MORADOR.varios} · 1 ${TEXTO_RECUSADO_PELO_MORADOR.um}`);
  assert.equal(os2.maisAntigoEm, "2026-11-22T12:00:00Z", "o detalhe é o mais antigo dos dois estados");
  // Os textos aprovados (ORDENS 780 e 782).
  assert.equal(TEXTO_ESPERA_DO_MORADOR.um, "pedido de avaliação à espera da concordância do morador");
  assert.equal(TEXTO_RECUSADO_PELO_MORADOR.um, "pedido de avaliação recusado pelo morador — à espera de nova data");
  // O título do painel e a frase sem pedidos (ORDEM-DUET-785).
  assert.equal(TITULO_ESPERA_DO_MORADOR, "Avaliações à espera do morador");
  assert.equal(VAZIO_ESPERA_DO_MORADOR, "Nenhum pedido de avaliação à espera do morador.");
});

test("E1175: a linha da Central usa o texto dos dois estados; as outras filas não mudam", () => {
  const d = DECISOES_ADMIN.find((x) => x.chave === "avaliacao_espera_moradora");
  assert.ok(d, "a linha existe");
  assert.equal(d.href, "/admin/avaliadores#espera-moradora");
  const r = montarDecisoesAdmin({
    avaliacao_espera_moradora: { n: 2, texto: `1 ${TEXTO_ESPERA_DO_MORADOR.um} · 1 ${TEXTO_RECUSADO_PELO_MORADOR.um}`, detalhe: "mais antigo há 2 dias" },
    avaliacao_sem_avaliador: { n: 3, detalhe: null },
  });
  const minha = r.linhas.find((l) => l.chave === "avaliacao_espera_moradora");
  assert.equal(minha?.texto, `1 ${TEXTO_ESPERA_DO_MORADOR.um} · 1 ${TEXTO_RECUSADO_PELO_MORADOR.um}`);
  const outra = r.linhas.find((l) => l.chave === "avaliacao_sem_avaliador");
  assert.equal(outra?.texto, "3 pedidos de avaliação sem avaliador elegível", "sem `texto`, a linha continua a dizer n + um/varios");
});

const ler = (p: string) => fonteSemComentarios(readFileSync(p, "utf8"));

test("E1175: a leitura decide pelas regras puras e devolve null no erro", () => {
  const s = ler("src/lib/data/avaliadores-contagens.ts");
  assert.match(s, /export async function pedidosAEsperaDaMoradora\(/);
  const corpo = s.slice(s.indexOf("export async function pedidosAEsperaDaMoradora("));
  assert.match(corpo, /aEsperaDaConcordancia\(/);
  assert.match(corpo, /concordanciaRecusada\(/);
  assert.match(corpo, /if \(error\) return null;/);
});

test("E1175: a Central e a página dos avaliadores leem a mesma função; a página tem a âncora", () => {
  for (const f of ["src/lib/data/admin-decisoes.ts", "src/app/(dashboard)/admin/avaliadores/page.tsx"]) {
    assert.match(ler(f), /pedidosAEsperaDaMoradora\(admin, /, f);
  }
  assert.match(ler("src/lib/data/admin-decisoes.ts"), /linhaEsperaDoMorador\(/);
  assert.match(ler("src/app/(dashboard)/admin/avaliadores/page.tsx"), /id="espera-moradora"/);
});
