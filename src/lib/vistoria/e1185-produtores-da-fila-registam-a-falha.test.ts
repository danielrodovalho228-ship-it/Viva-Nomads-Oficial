import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";
import { REGISTRO_DA_FALHA_NA_FILA, lerGravacaoNaFila } from "./gravacao-na-fila.ts";

/*
  E1185 (ORDEM-DUET-799; Central, nos intervalos). O E1182 curou a rotina do laudo: a gravação na fila da equipe passou a
  ser lida. Os outros produtores gravam pela função da fila (`naFilaDoAdmin`), que devolvia só "inseriu ou não": o banco a
  recusar o item e "já havia um item aberto" eram a mesma resposta, e nada ficava registado.
  A auditoria, produtor a produtor: os cinco gravam pela mesma função, e ela passa a ler a gravação pela leitura do
  E1182 — a recusa fica registada no servidor com o tipo, a referência e a mensagem do banco. O que ela devolve não
  muda (E1149): `true` só quando ESTA chamada inseriu.
  Roda: node --test src/lib/vistoria/e1185-produtores-da-fila-registam-a-falha.test.ts
*/
const ler = (p: string) => semComentarios(readFileSync(p, "utf8"));
const SERVIDOR = "src/lib/vistoria/servidor.ts";

/** Guarda o que foi para o registro de erro durante `f`. */
function comRegistro<T>(f: () => T): { saida: T; linhas: string[] } {
  const original = console.error;
  const linhas: string[] = [];
  console.error = (...a: unknown[]) => void linhas.push(a.map(String).join(" "));
  try {
    return { saida: f(), linhas };
  } finally {
    console.error = original;
  }
}

/** O corpo da função da fila, sem comentários. */
function funcaoDaFila(): string {
  const servidor = ler(SERVIDOR);
  const inicio = servidor.indexOf("export async function naFilaDoAdmin(");
  assert.ok(inicio >= 0, "não achei a função da fila");
  return servidor.slice(inicio, servidor.indexOf("\n}\n", inicio) + 3);
}

/** Os tipos que a função da fila aceita (a união fechada do segundo parâmetro). */
function tiposDaFuncao(): string[] {
  const uniao = /async function naFilaDoAdmin\(\s*admin: Admin,\s*tipo: ([^,]+),/.exec(funcaoDaFila());
  assert.ok(uniao, "não achei os tipos da função da fila");
  return [...uniao[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
}

/** Todos os arquivos de produto (sem testes) debaixo de `src`. */
function arquivosDeProduto(pasta = "src"): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((e) => {
    const p = join(pasta, e.name);
    if (e.isDirectory()) return arquivosDeProduto(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

test("E1185 (1): a função da fila lê a gravação — a recusa do banco deixa de ser igual a 'já havia item'", () => {
  const f = funcaoDaFila();
  assert.match(f, /const \{ error \} = await admin\.from\("vistoria_fila_admin"\)\.insert\(\{[^}]*\}\);/);
  assert.match(f, /return lerGravacaoNaFila\(error, \{ tipo, pedidoId: ref\.pedidoId, avaliadorId: ref\.avaliadorId \}\)\.inserido;/);
  assert.doesNotMatch(f, /return !error;/, "a função ainda devolve sem ler o erro");
  assert.match(ler(SERVIDOR), /import \{[^}]*\blerGravacaoNaFila\b[^}]*\} from "\.\/gravacao-na-fila";/);
});

test("E1185 (2): a recusa fica registada para cada tipo que a função grava, com o tipo, a referência e a mensagem", () => {
  const tipos = tiposDaFuncao();
  assert.deepEqual([...tipos].sort(), ["avaliacao_teste", "contestacao_sem_avaliador", "proposta_descredenciamento", "revisao_criterio", "sem_avaliador", "suspensao_automatica"]);
  const recusa = { code: "23514", message: 'new row for relation "vistoria_fila_admin" violates check constraint "vistoria_fila_admin_tipo_check"' };
  for (const tipo of tipos) {
    // A função passa a referência que recebeu: o pedido, ou o avaliador.
    for (const ref of [{ pedidoId: `pedido-de-${tipo}` }, { avaliadorId: `avaliador-de-${tipo}` }]) {
      const { saida, linhas } = comRegistro(() => lerGravacaoNaFila(recusa, { tipo, pedidoId: ref.pedidoId, avaliadorId: ref.avaliadorId }));
      assert.equal(saida.inserido, false, tipo);
      assert.equal(linhas.length, 1, `${tipo}: uma linha no registro`);
      assert.ok(linhas[0].startsWith(REGISTRO_DA_FALHA_NA_FILA), linhas[0]);
      for (const pedaco of [tipo, ref.pedidoId ?? ref.avaliadorId ?? "", "vistoria_fila_admin_tipo_check"]) assert.ok(linhas[0].includes(pedaco), `falta "${pedaco}" em: ${linhas[0]}`);
    }
  }
});

test("E1185 (3): o que a função devolve não muda (E1149) — inseriu: true; item já aberto: false, sem registro de erro", () => {
  const inseriu = comRegistro(() => lerGravacaoNaFila(null, { tipo: "sem_avaliador", pedidoId: "p1" }));
  assert.equal(inseriu.saida.inserido, true);
  assert.deepEqual(inseriu.linhas, []);
  const jaHavia = comRegistro(() => lerGravacaoNaFila({ code: "23505", message: 'duplicate key value violates unique constraint "vistoria_fila_admin_aberta"' }, { tipo: "sem_avaliador", pedidoId: "p1" }));
  assert.equal(jaHavia.saida.inserido, false, "quem chega em segundo não inseriu — e não avisa de novo");
  assert.deepEqual(jaHavia.linhas, [], "já existir não é erro: não suja o registro");
  // Erro sem código (rede, tempo esgotado) também é falha, e fica registado.
  const rede = comRegistro(() => lerGravacaoNaFila({ message: "fetch failed" }, { tipo: "revisao_criterio", avaliadorId: "a1" }));
  assert.equal(rede.saida.inserido, false);
  assert.equal(rede.linhas.length, 1);
});

test("E1185 (4): produtor a produtor — os cinco gravam pela função da fila", () => {
  const servidor = ler(SERVIDOR);
  const produtores: [string, string, RegExp][] = [
    ["a equipe põe o avaliador em teste", "src/lib/vistoria/actions.ts", /if \(para === "em_teste"\) await naFilaDoAdmin\(a\.admin, "avaliacao_teste", \{ avaliadorId: id \},/],
    ["o sistema põe o avaliador em teste", "src/lib/vistoria/ativacao-automatica-servidor.ts", /await naFilaDoAdmin\(admin, "avaliacao_teste", \{ avaliadorId: c\.id \},/],
    ["pedido sem avaliador", SERVIDOR, /inserir: \(m\) => naFilaDoAdmin\(admin, "sem_avaliador", \{ pedidoId: p\.id \}, m\)/],
    ["contestação sem segundo avaliador", SERVIDOR, /await naFilaDoAdmin\(admin, "contestacao_sem_avaliador", \{ pedidoId: p\.id \}, motivo\);/],
    ["critério público atingido", SERVIDOR, /await naFilaDoAdmin\(admin, "revisao_criterio", \{ avaliadorId \},/],
  ];
  for (const [nome, arquivo, chamada] of produtores) assert.match(arquivo === SERVIDOR ? servidor : ler(arquivo), chamada, `${nome}: não grava pela função da fila`);
  // São estes cinco e mais nenhum: produtor novo entra nesta lista, com o que acontece quando a gravação falha.
  const chamadas = arquivosDeProduto().flatMap((a) => [...ler(a).matchAll(/(?<!function )naFilaDoAdmin\(/g)].map(() => a));
  assert.deepEqual(chamadas.sort(), ["src/lib/vistoria/actions.ts", "src/lib/vistoria/ativacao-automatica-servidor.ts", SERVIDOR, SERVIDOR, SERVIDOR].sort());
});

test("E1185 (5): nenhuma gravação na fila fica de fora — em todo o produto, cada uma é lida", () => {
  const gravacoes: string[] = [];
  for (const arquivo of arquivosDeProduto()) {
    const fonte = ler(arquivo);
    for (const m of fonte.matchAll(/from\("vistoria_fila_admin"\)\s*\.(?:insert|upsert)\(/g)) {
      const antes = fonte.slice(Math.max(0, m.index - 60), m.index);
      const depois = fonte.slice(m.index, m.index + 420);
      // Duas formas aceites: a gravação dentro da leitura; ou o erro guardado e lido na linha seguinte (a função da fila).
      const lida = /lerGravacaoNaFila\(\(await admin\.$/.test(antes) || (/const \{ error \} = await admin\.$/.test(antes) && /\}\);\s*return lerGravacaoNaFila\(error, /.test(depois));
      assert.ok(lida, `${arquivo}: gravação na fila sem leitura do erro — ${antes.slice(-40)}${depois.slice(0, 60)}`);
      gravacoes.push(arquivo);
    }
  }
  // A função da fila e as três da rotina do laudo (E1182). Se alguma sair, esta trava deixa de a vigiar.
  assert.deepEqual(gravacoes.sort(), ["src/lib/vistoria/laudo-servidor.ts", "src/lib/vistoria/laudo-servidor.ts", "src/lib/vistoria/laudo-servidor.ts", SERVIDOR].sort());
});
