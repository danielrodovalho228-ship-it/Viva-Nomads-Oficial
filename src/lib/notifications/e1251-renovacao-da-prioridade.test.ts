/*
  E1251 (ESPEC-E1251 v3; ORDENS-DUET 1265, 1267, 1293 e 1307) — a renovação do aviso pendente leva a PRIORIDADE.
  O defeito: gravarAviso renovava o pendente (não lido, não resolvido, mesma pessoa e chave) com a hora, o título, o
  endereço e o texto novos — e a prioridade VELHA. A correção: a prioridade calcula-se uma vez (a da chamada; na falta, a
  da tabela por evento e papel) e entra nas duas gravações da renovação, na linha nova e no juntar dos repetidos (E586).
  Um aviso já LIDO não se renova: nasce outro, com a prioridade dele.
  Corre o gravarAviso REAL (harness e1072: o cliente admin é o falso daqui) sobre uma tabela de avisos em memória, fiel
  aos filtros (eq, is, order, limit) — a mesma pessoa, a mesma chave (evento + referência; sem referência, evento + título).
  Os casos R1, R2, R7, R9, R10, R11, R16 e R17 falham no código de antes; R3–R6, R8, R12–R15, R18 e R19 são guardas.
  Roda: node --test src/lib/notifications/e1251-renovacao-da-prioridade.test.ts
*/
import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { avisoDaRotina } from "./avisos-rotinas-contrato.ts";

register("../data/e1072-teto-harness/loader.mjs", import.meta.url);
const { gravarAviso } = await import("./avisos-servidor.ts");
const g = globalThis as unknown as { __e1072Admin: unknown };

type Linha = { id: string; usuario_id: string; evento: string; ref_id: string | null; titulo: string; prioridade: string; url: string | null; texto?: string | null; criado_em: string; lido_em: string | null; resolvido_em: string | null };
const PESSOA = "aaaaaaaa-0000-4000-8000-000000000001";
const OUTRA = "aaaaaaaa-0000-4000-8000-000000000002";
const CONTRATO = "c0c0c0c0-0000-4000-8000-000000000001";
const VISITA = "v1sita-0001";
let seq = 0;
const velho = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

/** A tabela avisos em memória. `semTexto`: o banco sem a coluna texto (0298). `cego`: a leitura do pendente não o vê (a corrida do E586). */
function banco(inicial: Partial<Linha>[] = [], o: { semTexto?: boolean; cego?: boolean } = {}) {
  const avisos: Linha[] = inicial.map((l) => ({ id: `a${++seq}`, usuario_id: PESSOA, evento: "visita_pedida", ref_id: null, titulo: "t", prioridade: "normal", url: null, texto: null, criado_em: velho(30), lido_em: null, resolvido_em: null, ...l }));
  const admin = {
    from(tabela: string) {
      const filtros: ((l: Linha) => boolean)[] = [];
      let op: "select" | "update" | "delete" = "select";
      let mudar: Record<string, unknown> = {};
      let limite = Infinity;
      let desc = false;
      let unico = false;
      const linhas = () => {
        const r = avisos.filter((l) => filtros.every((f) => f(l)));
        r.sort((a, b) => (desc ? Date.parse(b.criado_em) - Date.parse(a.criado_em) : 0));
        return r.slice(0, limite);
      };
      const executar = () => {
        if (tabela !== "avisos") return { data: tabela === "contrato_blocos" ? [] : null, error: null };
        if (op === "update") {
          if (o.semTexto && "texto" in mudar) return { data: null, error: { code: "42703", message: "sem texto" } };
          for (const l of linhas()) Object.assign(l, mudar);
          return { data: null, error: null };
        }
        if (op === "delete") {
          for (const l of linhas()) avisos.splice(avisos.indexOf(l), 1);
          return { data: null, error: null };
        }
        if (unico && o.cego) return { data: null, error: null };
        const r = linhas();
        return { data: unico ? (r[0] ?? null) : r, error: null };
      };
      const b: Record<string, unknown> = {
        select: () => b,
        eq: (k: string, v: unknown) => (filtros.push((l) => (l as Record<string, unknown>)[k] === v), b),
        is: (k: string, v: unknown) => (filtros.push((l) => ((l as Record<string, unknown>)[k] ?? null) === v), b),
        in: (k: string, v: unknown[]) => (filtros.push((l) => v.includes((l as Record<string, unknown>)[k])), b),
        order: (_k: string, x?: { ascending?: boolean }) => ((desc = x?.ascending === false), b),
        limit: (n: number) => ((limite = n), b),
        update: (v: Record<string, unknown>) => ((op = "update"), (mudar = v), b),
        delete: () => ((op = "delete"), b),
        insert: async (linha: Record<string, unknown>) => {
          if (o.semTexto && "texto" in linha) return { error: { code: "42703", message: "sem texto" } };
          avisos.push({ id: `a${++seq}`, criado_em: new Date().toISOString(), lido_em: null, resolvido_em: null, texto: null, ...(linha as object) } as Linha);
          return { error: null };
        },
        maybeSingle: async () => ((unico = true), executar()),
        then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(executar()).then(ok, ko),
      };
      return b;
    },
  };
  return { admin, avisos };
}
const daPessoa = (avisos: Linha[], uid = PESSOA) => avisos.filter((a) => a.usuario_id === uid);

test("R1. pendente não lido NORMAL + chega CRÍTICO → uma linha só, crítica, título e hora novos", async () => {
  const b = banco([{ evento: "visita_pedida", ref_id: VISITA, prioridade: "normal", titulo: "antigo" }]);
  g.__e1072Admin = b.admin;
  assert.equal(await gravarAviso({ usuarioId: PESSOA, evento: "visita_pedida", refId: VISITA, prioridade: "critico", titulo: "novo" }), true);
  assert.equal(b.avisos.length, 1);
  assert.equal(b.avisos[0].prioridade, "critico");
  assert.equal(b.avisos[0].titulo, "novo");
  assert.ok(Date.parse(b.avisos[0].criado_em) > Date.parse(velho(1)), "hora nova");
});

test("R2. pendente não lido CRÍTICO + chega NORMAL → uma linha só, normal (sai da faixa)", async () => {
  const b = banco([{ evento: "visita_pedida", ref_id: VISITA, prioridade: "critico" }]);
  g.__e1072Admin = b.admin;
  await gravarAviso({ usuarioId: PESSOA, evento: "visita_pedida", refId: VISITA, prioridade: "normal", titulo: "novo" });
  assert.deepEqual(b.avisos.map((a) => a.prioridade), ["normal"]);
});

test("R3. urgente sobre urgente → uma linha, urgente", async () => {
  const b = banco([{ evento: "visita_pedida", ref_id: VISITA, prioridade: "urgente" }]);
  g.__e1072Admin = b.admin;
  await gravarAviso({ usuarioId: PESSOA, evento: "visita_pedida", refId: VISITA, prioridade: "urgente" });
  assert.deepEqual(b.avisos.map((a) => a.prioridade), ["urgente"]);
});

test("R4/R5. o pendente já LIDO não se renova: nasce outro com a prioridade dele; o lido fica como estava", async () => {
  for (const [antes, chega] of [["critico", "normal"], ["normal", "critico"]] as const) {
    const b = banco([{ evento: "visita_pedida", ref_id: VISITA, prioridade: antes, lido_em: velho(5) }]);
    g.__e1072Admin = b.admin;
    await gravarAviso({ usuarioId: PESSOA, evento: "visita_pedida", refId: VISITA, prioridade: chega });
    assert.equal(b.avisos.length, 2, `${antes} → ${chega}`);
    assert.deepEqual([b.avisos[0].prioridade, !!b.avisos[0].lido_em], [antes, true]);
    assert.deepEqual([b.avisos[1].prioridade, b.avisos[1].lido_em], [chega, null]);
  }
});

test("R6. o RESOLVIDO fica intacto; nasce outro", async () => {
  const b = banco([{ evento: "visita_pedida", ref_id: VISITA, prioridade: "critico", resolvido_em: velho(5) }]);
  g.__e1072Admin = b.admin;
  await gravarAviso({ usuarioId: PESSOA, evento: "visita_pedida", refId: VISITA, prioridade: "normal" });
  assert.deepEqual(b.avisos.map((a) => [a.prioridade, !!a.resolvido_em]), [["critico", true], ["normal", false]]);
});

test("R7. sem referência (chave = evento + título): mesmo título, outra prioridade → uma linha, a prioridade nova", async () => {
  const b = banco([{ evento: "contract_status", ref_id: null, titulo: "Caução: devolução em atraso", prioridade: "normal" }]);
  g.__e1072Admin = b.admin;
  await gravarAviso({ usuarioId: PESSOA, evento: "contract_status", prioridade: "critico", titulo: "Caução: devolução em atraso" });
  assert.deepEqual(b.avisos.map((a) => a.prioridade), ["critico"]);
});

test("R8. chega SEM prioridade na chamada → a da tabela por evento e papel", async () => {
  const b = banco([{ evento: "manutencao_nova", ref_id: "m-1", prioridade: "critico" }]);
  g.__e1072Admin = b.admin;
  await gravarAviso({ usuarioId: PESSOA, evento: "manutencao_nova", refId: "m-1", papel: "dono" });
  assert.deepEqual(b.avisos.map((a) => a.prioridade), ["critico"], "o dono: crítico pela tabela");
});

test("R9. o banco sem a coluna do texto: a renovação grava a prioridade nova na mesma", async () => {
  const b = banco([{ evento: "visita_pedida", ref_id: VISITA, prioridade: "normal" }], { semTexto: true });
  g.__e1072Admin = b.admin;
  assert.equal(await gravarAviso({ usuarioId: PESSOA, evento: "visita_pedida", refId: VISITA, prioridade: "critico", texto: "linha" }), true);
  assert.deepEqual(b.avisos.map((a) => a.prioridade), ["critico"]);
});

test("R10. dois avisos quase juntos, prioridades diferentes → uma linha, com a prioridade do último a gravar", async () => {
  // A corrida do E586: o pendente (normal) já está lá, mas a leitura do segundo não o viu.
  const b = banco([{ evento: "visita_pedida", ref_id: VISITA, prioridade: "normal", criado_em: velho(0.01) }], { cego: true });
  g.__e1072Admin = b.admin;
  await gravarAviso({ usuarioId: PESSOA, evento: "visita_pedida", refId: VISITA, prioridade: "critico" });
  assert.equal(b.avisos.length, 1, "juntou");
  assert.equal(b.avisos[0].prioridade, "critico");
});

test("R11. o par real da assinatura: 'falta a sua assinatura' (crítico) → 'contrato assinado pelas duas partes' (normal), mesmo contrato", async () => {
  const b = banco();
  g.__e1072Admin = b.admin;
  await gravarAviso({ usuarioId: PESSOA, evento: "contract_status", refId: CONTRATO, papel: "dono" });
  assert.deepEqual(b.avisos.map((a) => a.prioridade), ["critico"]);
  const tituloAssinar = b.avisos[0].titulo;
  await gravarAviso({ usuarioId: PESSOA, evento: "contract_status", refId: CONTRATO, prioridade: "normal" });
  assert.equal(b.avisos.length, 1);
  assert.equal(b.avisos[0].prioridade, "normal");
  assert.notEqual(b.avisos[0].titulo, tituloAssinar, "o título novo");
});

test("R12–R14. as guardas: outra pessoa, outra referência, outro evento → intactos", async () => {
  const b = banco([
    { usuario_id: OUTRA, evento: "visita_pedida", ref_id: VISITA, prioridade: "normal" },
    { evento: "visita_pedida", ref_id: "v1sita-0002", prioridade: "normal" },
    { evento: "proposta_recebida", ref_id: VISITA, prioridade: "normal" },
  ]);
  g.__e1072Admin = b.admin;
  await gravarAviso({ usuarioId: PESSOA, evento: "visita_pedida", refId: VISITA, prioridade: "critico" });
  assert.deepEqual(b.avisos.slice(0, 3).map((a) => a.prioridade), ["normal", "normal", "normal"]);
  assert.equal(b.avisos.length, 4, "nasce a linha própria");
});

test("R15. a renovação não cria segunda linha (E550)", async () => {
  const b = banco([{ evento: "visita_pedida", ref_id: VISITA, prioridade: "critico" }]);
  g.__e1072Admin = b.admin;
  for (let i = 0; i < 3; i++) await gravarAviso({ usuarioId: PESSOA, evento: "visita_pedida", refId: VISITA, prioridade: "critico" });
  assert.equal(b.avisos.length, 1);
});

const lembrete = (papel: "proprietario" | "inquilino") => avisoDaRotina("preAceitacaoLembrete", papel);
test("R16. o par do pré-aceite (ORDEM-DUET 1293): moradora (crítico) e depois dona de outra proposta (normal) → uma linha, normal, com o endereço e o texto da segunda", async () => {
  const b = banco();
  g.__e1072Admin = b.admin;
  await gravarAviso({ usuarioId: PESSOA, evento: "contract_status", titulo: lembrete("inquilino").titulo, prioridade: lembrete("inquilino").prioridade, url: "/dashboard/propostas/pA", texto: "Proposta A" });
  await gravarAviso({ usuarioId: PESSOA, evento: "contract_status", titulo: lembrete("proprietario").titulo, prioridade: lembrete("proprietario").prioridade, url: "/dashboard/propostas/pB", texto: "Proposta B" });
  assert.equal(b.avisos.length, 1);
  assert.deepEqual([b.avisos[0].prioridade, b.avisos[0].url, b.avisos[0].texto], ["normal", "/dashboard/propostas/pB", "Proposta B"]);
});

test("R17. o mesmo par na ordem inversa: o crítico sobre o normal → uma linha, crítica, com o endereço e o texto da segunda", async () => {
  const b = banco();
  g.__e1072Admin = b.admin;
  await gravarAviso({ usuarioId: PESSOA, evento: "contract_status", titulo: lembrete("proprietario").titulo, prioridade: lembrete("proprietario").prioridade, url: "/dashboard/propostas/pB", texto: "Proposta B" });
  await gravarAviso({ usuarioId: PESSOA, evento: "contract_status", titulo: lembrete("inquilino").titulo, prioridade: lembrete("inquilino").prioridade, url: "/dashboard/propostas/pA", texto: "Proposta A" });
  assert.equal(b.avisos.length, 1);
  assert.deepEqual([b.avisos[0].prioridade, b.avisos[0].url, b.avisos[0].texto], ["critico", "/dashboard/propostas/pA", "Proposta A"]);
});

test("R18. a rotina repete o mesmo aviso: a prioridade dita na chamada, nunca a da tabela por evento", async () => {
  const b = banco();
  g.__e1072Admin = b.admin;
  const av = avisoDaRotina("caucaoLiberacaoIntegral", "proprietario");
  for (let i = 0; i < 2; i++) await gravarAviso({ usuarioId: PESSOA, evento: "contract_status", titulo: av.titulo, prioridade: av.prioridade, papel: "dono" });
  assert.deepEqual(b.avisos.map((a) => a.prioridade), ["normal"], "a tabela diria crítico para contract_status/dono");
});

test("R19. o aviso de assinatura (com a referência do contrato) e um de rotina do mesmo contrato (sem referência): duas linhas", async () => {
  const b = banco();
  g.__e1072Admin = b.admin;
  await gravarAviso({ usuarioId: PESSOA, evento: "contract_status", refId: CONTRATO, papel: "dono" });
  const av = avisoDaRotina("caucaoDevolucaoAtraso", "proprietario");
  await gravarAviso({ usuarioId: PESSOA, evento: "contract_status", titulo: av.titulo, prioridade: av.prioridade });
  assert.equal(b.avisos.length, 2);
  assert.deepEqual(b.avisos.map((a) => a.ref_id), [CONTRATO, null]);
});
