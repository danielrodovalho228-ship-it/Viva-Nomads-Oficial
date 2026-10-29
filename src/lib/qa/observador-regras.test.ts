/*
  QA-LOGIN-B v2 — admin observador: a decisão (com dados falsos) e a guarda de que cada ação da lista chama a recusa.
  Roda: node --test src/lib/qa/observador-regras.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { MSG_OBSERVADOR, recusaComDeps, type DepsObservador } from "./observador-regras.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

// Mundo falso: "obs" é o observador; "adm" é admin comum; donos de teste e reais.
const TESTE = new Set(["dono-teste", "morador-teste"]);
const DONOS: Record<string, string> = { "imovel-teste": "dono-teste", "imovel-real": "dono-real", "pedido-teste": "morador-teste", "doc-real": "dono-real" };
const deps: DepsObservador = {
  qaAdmin: async (id) => id === "obs",
  donos: async (_t, ids) => ids.map((i) => DONOS[i]).filter(Boolean),
  perfisTeste: async (ids) => new Set(ids.filter((i) => TESTE.has(i))),
};

test("admin comum: nada muda, nenhuma ação é recusada", async () => {
  assert.equal(await recusaComDeps(deps, "adm"), null);
  assert.equal(await recusaComDeps(deps, "adm", { imoveis: ["imovel-real"] }), null);
});

test("observador: ações sem alvo (chaves, tipo/marca de conta, Caixa, backup) → recusa sempre, com mensagem clara", async () => {
  assert.equal(await recusaComDeps(deps, "obs"), MSG_OBSERVADOR);
  assert.match(MSG_OBSERVADOR, /admin observador/);
});

test("observador: dado real → só leitura (recusa); dado de teste → liberado", async () => {
  assert.equal(await recusaComDeps(deps, "obs", { imoveis: ["imovel-real"] }), MSG_OBSERVADOR);
  assert.equal(await recusaComDeps(deps, "obs", { documentos: ["doc-real"] }), MSG_OBSERVADOR);
  assert.equal(await recusaComDeps(deps, "obs", { perfis: ["dono-real"] }), MSG_OBSERVADOR);
  assert.equal(await recusaComDeps(deps, "obs", { imoveis: ["imovel-teste"] }), null);
  assert.equal(await recusaComDeps(deps, "obs", { pedidosMoradia: ["pedido-teste"] }), null);
  assert.equal(await recusaComDeps(deps, "obs", { perfis: ["morador-teste"], imoveis: ["imovel-teste"] }), null);
  // Misturado: um real basta para recusar.
  assert.equal(await recusaComDeps(deps, "obs", { imoveis: ["imovel-teste", "imovel-real"] }), MSG_OBSERVADOR);
  // Sem dono identificável (registro some, pedido de parceria sem conta) = real.
  assert.equal(await recusaComDeps(deps, "obs", { imoveis: ["nao-existe"] }), MSG_OBSERVADOR);
  assert.equal(await recusaComDeps(deps, "obs", { semPerfil: 1 }), MSG_OBSERVADOR);
  assert.equal(await recusaComDeps(deps, "obs", {}), MSG_OBSERVADOR);
});

test("GUARDA: cada ação da lista confere o observador ANTES de gravar", () => {
  const casos: [string, string, RegExp][] = [
    // chaves da plataforma
    ["../data/pedidos-admin.ts", "definirChaveSms", /recusaObservador\(user\.id\);/],
    ["../parceiros/admin-actions.ts", "definirParceiroGeral", /recusaObservador\(a\.user\.id\);/],
    // tipo e marca de teste de conta (o que existe no app de "mudar papel"); excluir/anonimizar pelo admin não existe
    ["../data/planos-actions.ts", "definirAccountType", /recusaObservador\(user\.id\);/],
    ["../data/conta-teste-actions.ts", "marcarContaTeste", /recusaObservador\(/],
    // Caixa dos Sócios
    ["../socios/caixa-actions.ts", "sessaoAdmin", /recusaObservador\(user\.id\)/],
    // dados reais: documentos, matrícula, anúncio, pedido, parceiro, foto de perfil, identidade
    ["../data/documentos-admin.ts", "moderarDocumento", /recusaObservador\(user\.id, \{ documentos: \[qualId\] \}\)/],
    ["../data/documentos-admin.ts", "reabrirConferencia", /recusaObservador\(user\.id, \{ documentos: \[qualId\] \}\)/],
    ["../data/matriculas-admin.ts", "decidirMatriculaAdmin", /recusaObservador\(user\.id, \{ perfis:/],
    ["../data/imoveis-admin-actions.ts", "pausarImovelAdmin", /recusaObservador\(user\.id, \{ imoveis: \[id\] \}\)/],
    ["../data/pedidos-admin.ts", "moderarPedido", /recusaObservador\(user\.id, \{ pedidosMoradia: \[pedidoId\] \}\)/],
    ["../data/pedidos-admin.ts", "reativarPedido", /recusaObservador\(user\.id, \{ pedidosMoradia: \[pedidoId\] \}\)/],
    ["../parceiros/admin-actions.ts", "aprovarSolicitacao", /recusaObservador\(a\.user\.id, await alvoDaSolicitacao/],
    ["../parceiros/admin-actions.ts", "recusarSolicitacao", /recusaObservador\(a\.user\.id, await alvoDaSolicitacao/],
    ["../parceiros/admin-actions.ts", "salvarChecklistParceria", /recusaObservador\(a\.user\.id, await alvoDaSolicitacao/],
    ["../parceiros/admin-actions.ts", "reenviarAtivacao", /recusaObservador\(a\.user\.id, await alvoDaSolicitacao/],
    ["../parceiros/admin-actions.ts", "suspenderParceiro", /recusaObservador\(a\.user\.id, \{ perfis:/],
    ["../parceiros/admin-actions.ts", "denunciaNotaProcedente", /recusaObservador\(a\.user\.id\);/],
    ["../parceiros/admin-actions.ts", "criarSolicitacaoSuporte", /recusaObservador\(a\.user\.id\);/],
    ["../data/fotos-perfil-actions.ts", "aprovarFotoPerfil", /recusaObservador\(a\.user\.id, \{ perfis:/],
    ["../data/fotos-perfil-actions.ts", "removerFotoPerfil", /recusaObservador\(a\.user\.id, \{ perfis:/],
    ["../identidade/revisao-actions.ts", "adminDecidirVerificacao", /recusaObservador\(user\.id, \{ perfis:/],
  ];
  for (const [arq, fn, re] of casos) {
    const src = ler(arq);
    const ini = src.search(new RegExp(`(export )?async function ${fn}\\(`));
    assert.ok(ini >= 0, `${fn} em ${arq}`);
    const resto = src.slice(ini + 10);
    const fim = resto.search(/\n(export )?(async )?function /);
    const corpo = fim >= 0 ? resto.slice(0, fim) : resto;
    const i = corpo.search(re);
    assert.ok(i >= 0, `${fn}: chama recusaObservador`);
    // Antes de qualquer gravação (update/insert/upsert/delete/rpc) da própria função.
    const gravacao = corpo.search(/\.(update|insert|upsert|delete)\(|\.rpc\((?!"is_admin")|mudarContaTeste\(/);
    if (gravacao >= 0) assert.ok(i < gravacao, `${fn}: recusa antes de gravar`);
  }
});

test("GUARDA: telas — Caixa dos Sócios 404 e Sistema sem os botões de chave/backup para o observador; RLS na 0252", () => {
  assert.match(ler("../../app/(dashboard)/admin/socios/page.tsx"), /if \(await ehObservadorQa\(uidAtual\)\) notFound\(\)/);
  const sistema = ler("../../app/(dashboard)/admin/sistema/page.tsx");
  assert.match(sistema, /observador \? \(/);
  assert.match(sistema, /\{observador \? null : <ParceiroGeralForm/);
  assert.match(sistema, /\{observador \? null : <CartaoBackup \/>\}/);
  assert.match(sistema, /<PortaQaPainel \/>/);
  const mig = ler("../../../supabase/migrations/0252_qa_admin_observador.sql");
  for (const pol of ["caixa_socios: admin le", "caixa_socios: admin envia", "caixa_socios: admin atualiza", "caixa-socios: admin le", "caixa-socios: admin envia"]) {
    assert.match(mig, new RegExp(`create policy "${pol}"[\\s\\S]*?not public\\.is_qa_admin\\(auth\\.uid\\(\\)\\)`), pol);
  }
  // is_admin() e a regra do 2FA não mudam.
  assert.doesNotMatch(mig, /create or replace function public\.is_admin\(/);
});
