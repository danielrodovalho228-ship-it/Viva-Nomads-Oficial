import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";
import { REGISTRO_DA_FALHA_NA_FILA, lerGravacaoNaFila, marcarComItemNaFila } from "./gravacao-na-fila.ts";

/*
  E1182 (ORDEM-DUET-791; linha Parceiros). A rotina do laudo gravava o item na fila da equipe sem olhar o erro. Quando
  o banco recusou quatro tipos (da migração 0313 à 0363), a rotina marcou o pedido como "atrasado", não gravou o item e
  não disse nada: o silêncio é que tornou a falha invisível.
  A cura: cada gravação é lida. Se falhar, fica registada no servidor, conta no resumo da rotina, a marca é desfeita (a
  rotina tenta de novo no tique seguinte) e ninguém é avisado de um item que não existe.
  Roda: node --test src/lib/vistoria/e1182-gravacao-na-fila-nao-fica-calada.test.ts
*/
const ler = (p: string) => semComentarios(readFileSync(p, "utf8"));

/** Guarda o que foi para o registro de erro durante `f`. */
async function comRegistro<T>(f: () => T | Promise<T>): Promise<{ saida: T; linhas: string[] }> {
  const original = console.error;
  const linhas: string[] = [];
  console.error = (...a: unknown[]) => void linhas.push(a.map(String).join(" "));
  try {
    return { saida: await f(), linhas };
  } finally {
    console.error = original;
  }
}

test("E1182 (1): a gravação que deu certo conta como inserida, sem registro de erro", async () => {
  const { saida, linhas } = await comRegistro(() => lerGravacaoNaFila(null, { tipo: "laudo_atrasado", pedidoId: "p1" }));
  assert.deepEqual(saida, { inserido: true, erro: null });
  assert.deepEqual(linhas, []);
});

test("E1182 (2): item aberto que já existia (índice único) não é falha — nem inserção: ninguém é avisado de novo", async () => {
  const { saida, linhas } = await comRegistro(() => lerGravacaoNaFila({ code: "23505", message: "duplicate key value violates unique constraint \"vistoria_fila_admin_aberta\"" }, { tipo: "devolucao_vencida", avaliadorId: "a1" }));
  assert.deepEqual(saida, { inserido: false, erro: null });
  assert.deepEqual(linhas, [], "já existir não é erro: não suja o registro");
});

test("E1182 (3): a gravação recusada fica registada, com o tipo, a referência e a mensagem do banco", async () => {
  const recusa = { code: "23514", message: "new row for relation \"vistoria_fila_admin\" violates check constraint \"vistoria_fila_admin_tipo_check\"" };
  const { saida, linhas } = await comRegistro(() => lerGravacaoNaFila(recusa, { tipo: "laudo_atrasado", pedidoId: "pedido-7" }));
  assert.deepEqual(saida, { inserido: false, erro: recusa.message });
  assert.equal(linhas.length, 1);
  assert.ok(linhas[0].startsWith(REGISTRO_DA_FALHA_NA_FILA), linhas[0]);
  for (const pedaco of ["laudo_atrasado", "pedido-7", "vistoria_fila_admin_tipo_check"]) assert.ok(linhas[0].includes(pedaco), `falta "${pedaco}" em: ${linhas[0]}`);
  // Erro sem código (rede, tempo esgotado) também é falha.
  assert.deepEqual((await comRegistro(() => lerGravacaoNaFila({ message: "fetch failed" }, { tipo: "ressalva_vencida", pedidoId: "p2" }))).saida, { inserido: false, erro: "fetch failed" });
});

/** Os passos de uma marcação, com o registro do que foi chamado e em que ordem. */
function passos(gravacao: { code?: string; message: string } | null) {
  const chamadas: string[] = [];
  return {
    chamadas,
    p: {
      marcar: async () => void chamadas.push("marcar"),
      gravar: async () => {
        chamadas.push("gravar");
        return lerGravacaoNaFila(gravacao, { tipo: "laudo_atrasado", pedidoId: "p1" });
      },
      desmarcar: async () => void chamadas.push("desmarcar"),
      avisar: async () => void chamadas.push("avisar"),
    },
  };
}

test("E1182 (4): item gravado — a marca fica e a equipe é avisada, nesta ordem", async () => {
  const { chamadas, p } = passos(null);
  assert.equal(await marcarComItemNaFila(p), "inserido");
  assert.deepEqual(chamadas, ["marcar", "gravar", "avisar"]);
});

test("E1182 (5): gravação recusada — a marca é desfeita e ninguém é avisado de um item que não existe", async () => {
  const { chamadas, p } = passos({ code: "23514", message: "violates check constraint" });
  const { saida, linhas } = await comRegistro(() => marcarComItemNaFila(p));
  assert.equal(saida, "falhou");
  assert.deepEqual(chamadas, ["marcar", "gravar", "desmarcar"]);
  assert.equal(linhas.length, 1, "a falha foi registada uma vez");
});

test("E1182 (6): item que já existia — a marca fica, sem aviso novo e sem desfazer", async () => {
  const { chamadas, p } = passos({ code: "23505", message: "duplicate key" });
  assert.equal(await marcarComItemNaFila(p), "ja_existia");
  assert.deepEqual(chamadas, ["marcar", "gravar"]);
});

test("E1182 (7): se desfazer a marca também falhar, a falha continua a contar — e fica registada", async () => {
  const { p } = passos({ message: "fetch failed" });
  const { saida, linhas } = await comRegistro(() =>
    marcarComItemNaFila({
      ...p,
      desmarcar: async () => {
        throw new Error("banco fora do ar");
      },
    }),
  );
  assert.equal(saida, "falhou");
  assert.equal(linhas.length, 2, "a gravação recusada e a marca que não se desfez");
  assert.ok(linhas[1].includes("banco fora do ar"));
});

test("E1182 (estático): as três gravações da rotina do laudo são lidas, e a falha conta no resumo", () => {
  const rotina = ler("src/lib/vistoria/laudo-servidor.ts");
  const corpo = rotina.slice(rotina.indexOf("export async function rotinaLaudos"));
  // Nenhuma gravação na fila sem leitura do resultado.
  const gravacoes = [...corpo.matchAll(/from\("vistoria_fila_admin"\)\.insert\(\{ tipo: "([a-z_]+)"/g)].map((m) => m[1]);
  assert.deepEqual(gravacoes, ["laudo_atrasado", "ressalva_vencida", "devolucao_vencida"]);
  assert.equal((corpo.match(/lerGravacaoNaFila\(\(await admin\.from\("vistoria_fila_admin"\)\.insert\(/g) ?? []).length, 3, "as três passam pela leitura");
  assert.doesNotMatch(corpo, /^\s*await admin\.from\("vistoria_fila_admin"\)\.insert\(/m, "nenhuma gravação solta");
  // O laudo atrasado e a devolução: marca, grava, desfaz se falhar, e só avisa a equipe se o item entrou.
  assert.equal((corpo.match(/await marcarComItemNaFila\(\{/g) ?? []).length, 2);
  assert.match(corpo, /desmarcar: \(\) => admin\.from\("vistoria_pedidos"\)\.update\(\{ laudo_atrasado_em: null \}\)\.eq\("id", p\.id\)\.eq\("laudo_atrasado_em", quando\)/);
  assert.match(corpo, /desmarcar: \(\) => admin\.from\("vistoria_devolucoes"\)\.update\(\{ fila_em: null \}\)\.eq\("id", d\.id\)\.eq\("fila_em", quando\)/);
  assert.match(corpo, /avisar: \(\) => avisarAdmins\(admin, "vistoria_fila_admin", "laudo_atrasado"\)/);
  assert.match(corpo, /avisar: \(\) => avisarAdmins\(admin, "vistoria_fila_admin", "devolucao_vencida"\)/);
  // A ressalva vencida: se o item não entra, a ressalva volta a valer para a rotina (como já era com o strike).
  const ressalva = corpo.slice(corpo.indexOf('tipo: "ressalva_vencida"'), corpo.indexOf('"vistoria_ressalva_vencida"'));
  assert.match(ressalva, /if \(gravada\.erro\) \{\s*await admin\.from\("vistoria_laudos"\)\.update\(\{ ressalva_vencida_em: null \}\)\.eq\("id", l\.id\);\s*r\.falhasNaFila\+\+;\s*continue;\s*\}/);
  // Cada falha conta, e a contagem sai no resumo da rotina.
  assert.equal((corpo.match(/r\.falhasNaFila\+\+;/g) ?? []).length, 3);
  assert.match(rotina, /falhasNaFila: number;/);
  assert.match(corpo, /falhasNaFila: 0 \}/);
});

test("E1182 (estático): a rotina responde 'ok: false' quando alguma gravação na fila falhou", () => {
  const rota = ler("src/app/api/cron/vistoria/route.ts");
  assert.match(rota, /ok: laudos\.falhasNaFila === 0,/);
  assert.doesNotMatch(rota, /ok: true/);
});
