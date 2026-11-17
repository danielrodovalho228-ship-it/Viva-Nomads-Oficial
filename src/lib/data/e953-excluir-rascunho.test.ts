/*
  E953 T2 — excluir rascunho: (1) nenhuma leitura de draft_data com o cliente de SESSÃO (só a RPC ou o cliente admin com
  consistency-ignore); (2) deleteProperty recusa imóvel publicado; (3) não apaga nada quando a leitura do rascunho falha.
  Roda: node --test src/lib/data/e953-excluir-rascunho.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { ERRO_EXCLUIR_RASCUNHO, ERRO_SO_RASCUNHO, excluirRascunhoDoDono, type ClienteExclusao } from "./excluir-rascunho-servidor.ts";

/** Cliente falso: registra as chamadas; `linha`, `rpc` e `fotos` dizem o que o banco devolve. */
function falso(o: { linha?: { id: string; status: string } | null; erroLinha?: unknown; rpc?: { data: unknown; error: unknown }; fotos?: { data: unknown; error: unknown } }) {
  const chamadas: string[] = [];
  const resolvido = (v: unknown) => Promise.resolve(v);
  const cliente = {
    rpc(fn: string) {
      chamadas.push(`rpc:${fn}`);
      return resolvido(o.rpc ?? { data: [{ draft_data: { photos: [{ url: "https://x/storage/v1/object/public/property-photos/u/r.jpg" }] } }], error: null });
    },
    from(tabela: string) {
      return {
        select(colunas: string) {
          chamadas.push(`select:${tabela}:${colunas}`);
          const filtro = {
            eq() {
              return filtro;
            },
            maybeSingle() {
              return resolvido({ data: o.linha === undefined ? { id: "p1", status: "draft" } : o.linha, error: o.erroLinha ?? null });
            },
            then(ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) {
              return resolvido(o.fotos ?? { data: [{ url: "https://x/a.jpg" }], error: null }).then(ok, erro);
            },
          };
          return filtro;
        },
        delete() {
          chamadas.push(`delete:${tabela}`);
          const f = {
            eq() {
              return f;
            },
            then(ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) {
              return resolvido({ data: null, error: null }).then(ok, erro);
            },
          };
          return f;
        },
      };
    },
  };
  return { cliente: cliente as unknown as ClienteExclusao, chamadas };
}

test("T2: rascunho do dono → lê a linha SEM draft_data, draft_data pela RPC, apaga e devolve as fotos (tabela + rascunho)", async () => {
  const { cliente, chamadas } = falso({});
  const r = await excluirRascunhoDoDono(cliente, "u1", "p1");
  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && r.urlsFotos, ["https://x/a.jpg", "https://x/storage/v1/object/public/property-photos/u/r.jpg"]);
  assert.ok(chamadas.includes("select:properties:id, status"));
  assert.ok(!chamadas.some((c) => c.startsWith("select:properties") && c.includes("draft_data")), "nenhum SELECT de draft_data");
  assert.ok(chamadas.includes("rpc:property_private_details"));
  assert.ok(chamadas.includes("delete:properties"));
});

test("T2: deleteProperty recusa imóvel publicado (e não apaga nada)", async () => {
  for (const status of ["active", "paused", "pending"]) {
    const { cliente, chamadas } = falso({ linha: { id: "p1", status } });
    const r = await excluirRascunhoDoDono(cliente, "u1", "p1");
    assert.deepEqual(r, { ok: false, error: ERRO_SO_RASCUNHO }, status);
    assert.ok(!chamadas.some((c) => c.startsWith("delete:")), `${status}: nada apagado`);
  }
});

test("T2: leitura do rascunho falhou (RPC ou fotos) → não apaga nada", async () => {
  for (const o of [{ rpc: { data: null, error: { code: "42501" } } }, { fotos: { data: null, error: { code: "500" } } }, { erroLinha: { code: "42501" } }]) {
    const { cliente, chamadas } = falso(o);
    const r = await excluirRascunhoDoDono(cliente, "u1", "p1");
    assert.deepEqual(r, { ok: false, error: ERRO_EXCLUIR_RASCUNHO });
    assert.ok(!chamadas.some((c) => c.startsWith("delete:")), JSON.stringify(o));
  }
});

test("T2: rascunho que não é do usuário (sem linha) → nada apagado", async () => {
  const { cliente, chamadas } = falso({ linha: null });
  const r = await excluirRascunhoDoDono(cliente, "u1", "p1");
  assert.equal(r.ok, false);
  assert.ok(!chamadas.some((c) => c.startsWith("delete:")));
});

test("T2 (estático): nenhuma consulta com o cliente de SESSÃO seleciona draft_data — só a RPC ou o admin com consistency-ignore", () => {
  const arquivos = execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx'", { encoding: "utf8" })
    .split("\n")
    .filter((f) => f && !/\.test\.tsx?$/.test(f));
  const ruins: string[] = [];
  for (const f of arquivos) {
    const fonte = readFileSync(f, "utf8");
    for (const m of fonte.matchAll(/([\w$.]+(?:\(\))?)\s*\.from\(\s*["'`]properties["'`]\s*\)\s*\.select\(\s*(["'`])([^"'`]*)\2/g)) {
      if (!/\bdraft_data\b/.test(m[3])) continue;
      const linha = fonte.slice(0, m.index).split("\n").length;
      const textoLinha = fonte.split("\n")[linha - 1] ?? "";
      const admin = /^(admin|adm|createAdminClient\(\))$/i.test(m[1]) || /\badmin\b/i.test(m[1]);
      if (!admin || !/consistency-ignore/.test(textoLinha)) ruins.push(`${f}:${linha} [${m[1]}]`);
    }
  }
  assert.deepEqual(ruins, []);
  // deleteProperty delega a exclusão à função testada acima (com o cliente da sessão).
  const acoes = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
  const corpo = acoes.slice(acoes.indexOf("export async function deleteProperty"), acoes.indexOf("\n}\n", acoes.indexOf("export async function deleteProperty")));
  assert.match(corpo, /excluirRascunhoDoDono\(supabase, user\.id, id\)/);
  assert.doesNotMatch(corpo, /select\([^)]*draft_data/);
});
