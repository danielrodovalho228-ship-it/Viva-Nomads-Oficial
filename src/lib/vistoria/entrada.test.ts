/*
  Correção 62-B3 — porta de entrada do avaliador. Roda: node --test src/lib/vistoria/entrada.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { proximoAvaliador, type AvaliadorFila, type HistoricoDesignacao, type PedidoParaDesignar } from "./regras.ts";
import { PENDENCIA_IDENTIDADE, contaComoAvaliadorAtivo, ehPedidoDeAvaliador, faltaParaAtivar, podeAtivar, pendenciasDoCredenciamento, podeAprovarParaTeste, solicitacaoDoAvaliador, validarPedidoAvaliador } from "./entrada.ts";
import { CATEGORIAS_CATALOGO, categoriaValida, validarSolicitacao } from "../parceiros/regras.ts";

const CPF = "52998224725";
const base = { cidade: "Uberlândia", experienciaLink: "https://portfolio.exemplo.com", experienciaArquivo: false, aceiteConduta: true };

test("'vistoria' só pelo caminho do credenciamento: a solicitação comum e o catálogo continuam recusando", () => {
  assert.equal(categoriaValida("vistoria"), false);
  assert.ok(!CATEGORIAS_CATALOGO.some((c) => c.valor === "vistoria"));
  const r = validarSolicitacao({ nome: "Ana Avaliadora", tipoPessoa: "pf", documento: CPF, categorias: ["vistoria"], cidades: ["Uberlândia"], aceite: true, descricao: "Avaliação de imóveis" });
  assert.equal(r.ok, false);
  const s = solicitacaoDoAvaliador({ nome: "Ana Avaliadora", tipoPessoa: "pf", documento: CPF }, "Uberlândia", null, "u1", "ana@x.com");
  assert.deepEqual(s.categorias, ["vistoria"]);
  assert.equal(ehPedidoDeAvaliador(s.categorias), true);
  assert.equal(ehPedidoDeAvaliador(["limpeza"]), false);
});

test("quem NÃO é parceiro manda os dados de parceiro + os do credenciamento", () => {
  const ok = validarPedidoAvaliador({ ...base, jaParceiro: false, nome: "Ana Avaliadora", tipoPessoa: "pf", documento: "529.982.247-25" });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.valor.parceiro, { nome: "Ana Avaliadora", tipoPessoa: "pf", documento: CPF });
  const falta = validarPedidoAvaliador({ ...base, jaParceiro: false, nome: "A", tipoPessoa: "pf", documento: "11111111111" });
  assert.equal(falta.ok, false);
  if (!falta.ok) assert.deepEqual(falta.falta, ["Informar o nome público (o seu ou o da empresa).", "CPF válido."]);
});

test("quem JÁ é parceiro não repete dados (os campos de parceiro são ignorados)", () => {
  const r = validarPedidoAvaliador({ ...base, jaParceiro: true });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.valor.parceiro, null);
  const sem = validarPedidoAvaliador({ jaParceiro: true, cidade: "", experienciaArquivo: false, aceiteConduta: false });
  assert.equal(sem.ok, false);
  if (!sem.ok) assert.equal(sem.falta.length, 3);
});

test("E35-B: identidade não verificada registra o pedido com pendência e NÃO bloqueia a aprovação para teste", () => {
  // A identidade não é campo do pedido: nada em validarPedidoAvaliador a recusa.
  assert.equal(validarPedidoAvaliador({ ...base, jaParceiro: true }).ok, true);
  assert.deepEqual(pendenciasDoCredenciamento({ identidadeVerificada: false }), [PENDENCIA_IDENTIDADE]);
  assert.deepEqual(pendenciasDoCredenciamento({ identidadeVerificada: true }), []);
  // Candidato real sem identidade: aprovar para teste é aceito (a identidade é da ativação).
  assert.equal(podeAprovarParaTeste({ status: "solicitado" }).ok, true);
  assert.equal(podeAprovarParaTeste({ status: "em_teste" }).ok, false);
  const acoes = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
  const bloco = acoes.slice(acoes.indexOf('if (para === "em_teste") {'), acoes.indexOf('if (para === "ativo") {'));
  assert.doesNotMatch(bloco, /estadoIdentidade\(|identidadeVerificada/, "aprovar para teste não lê a identidade");
});

test("textos da entrada: 'avaliação do imóvel' e 'avaliador credenciado'; nunca inspeção, perícia ou engenharia", () => {
  for (const f of ["src/app/(public)/parceiros/avaliadores/page.tsx", "src/lib/vistoria/entrada.ts"]) {
    const t = readFileSync(new URL(`../../../${f}`, import.meta.url), "utf8");
    assert.doesNotMatch(t, /inspe[cç][aã]o|per[ií]cia|engenharia/i, f);
  }
});

test("E30: aprovar para teste nunca ativa; ativar só com a avaliação de teste registrada", () => {
  // Aprovar para teste leva a "em_teste" e nada além (a transição é a única coisa que a ação grava).
  const acoes = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
  const decidir = acoes.slice(acoes.indexOf("export async function adminDecidirCredenciamento"), acoes.indexOf("async function ativarParceiroDoAvaliador"));
  assert.match(decidir, /ativado_em: agora[^\n]*para === "ativo"|para === "ativo" && c\.status === "em_teste" \? \{ ativado_em/);
  assert.match(decidir, /if \(para === "ativo"\) \{[\s\S]*?comTesteConcluido\(a\.admin, \[id\]\)[\s\S]*?estadoIdentidade\(a\.admin[\s\S]*?podeAtivar\(\{[^}]*identidadeConfirmada: ident\?\.estado === "confirmada"/, "ativar confere o teste e a identidade no servidor");
  assert.doesNotMatch(decidir.slice(decidir.indexOf('if (para === "em_teste") {'), decidir.indexOf("// E30")), /status: "ativo"/);
  // Regra pura.
  const comId = { identidadeConfirmada: true };
  assert.equal(podeAtivar({ status: "em_teste", testeConcluido: false, ...comId }).ok, false);
  assert.equal(podeAtivar({ status: "suspenso", testeConcluido: false, ...comId }).ok, false, "reativar quem nunca fez o teste também não");
  assert.equal(podeAtivar({ status: "em_teste", testeConcluido: true, ...comId }).ok, true);
  assert.equal(podeAtivar({ status: "solicitado", testeConcluido: true, ...comId }).ok, false, "do pedido recebido não se pula para ativo");
  // Na interface, sem o teste registrado, o botão de ativar não existe (só o aviso).
  const tela = readFileSync(new URL("../../app/(dashboard)/admin/avaliadores/page.tsx", import.meta.url), "utf8");
  assert.match(tela, /para === "ativo" && faltaParaAtivar\(\{ testeConcluido: testeFeito\.has\(c\.id\), identidadeConfirmada: identidade\.get\(c\.id\) === "confirmada" \}\)\.length > 0 \?[\s\S]*?data-testid="decidir-ativo-bloqueado"/);
});

test("E35-B: ativar exige o teste revisado E a identidade confirmada; recusa diz o que falta, um item por linha", () => {
  // Ativar recusado sem identidade, mesmo com o teste revisado (também para reativar quem está suspenso).
  const semId = podeAtivar({ status: "em_teste", testeConcluido: true, identidadeConfirmada: false });
  assert.deepEqual(semId, { ok: false, motivo: "A identidade ainda não foi confirmada.", falta: ["A identidade ainda não foi confirmada."] });
  assert.equal(podeAtivar({ status: "suspenso", testeConcluido: true, identidadeConfirmada: false }).ok, false);
  // Sem nada: as duas linhas, na ordem.
  const nada = podeAtivar({ status: "em_teste", testeConcluido: false, identidadeConfirmada: false });
  assert.equal(nada.ok, false);
  assert.equal(!nada.ok && nada.motivo, "A avaliação de teste ainda não foi feita e revisada.\nA identidade ainda não foi confirmada.");
  // Com os dois: aceito.
  assert.deepEqual(podeAtivar({ status: "em_teste", testeConcluido: true, identidadeConfirmada: true }), { ok: true });
  assert.deepEqual(faltaParaAtivar({ testeConcluido: true, identidadeConfirmada: true }), []);
});

test("E35-B: candidato em teste nunca recebe pedido real; o teste só em imóvel de conta de teste; parceiro nasce em rascunho", () => {
  const fila = (status: string): AvaliadorFila => ({ id: "a1", userId: "u1", cidade: "Uberlândia", status, teste: false, credenciadoEm: "2026-10-01T00:00:00Z", ultimaDesignacaoEm: null, relacoesDonos: [], relacoesImoveis: [] }) as unknown as AvaliadorFila;
  const pedido = (teste: boolean): PedidoParaDesignar => ({ id: "p1", propertyId: "im1", ownerId: "d1", cidade: "Uberlândia", tipo: "entrada", teste, primeiroAvaliadorId: null, jaDesignados: [] }) as unknown as PedidoParaDesignar;
  const hist: HistoricoDesignacao = { avaliacoesDoImovel: [], servicosAoDono: [] } as unknown as HistoricoDesignacao;
  const agora = new Date("2026-10-24T12:00:00Z");
  // Pedido REAL: em teste não entra no rodízio (nem recebe o endereço, que só vai a quem é designado).
  assert.equal(proximoAvaliador([fila("em_teste")], pedido(false), hist, agora).avaliador, null);
  assert.equal(proximoAvaliador([fila("ativo")], pedido(false), hist, agora).avaliador?.id, "a1");
  // Pedido de TESTE: o candidato em teste pode receber.
  assert.equal(proximoAvaliador([fila("em_teste")], pedido(true), hist, agora).avaliador?.id, "a1");
  const acoes = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
  assert.match(acoes, /if \(!dono\?\.is_teste\) return \{ ok: false, erro: "A avaliação de teste é só em imóvel de conta de teste\." \}/);
  // ativarParceiroDoAvaliador continua no "Aprovar para teste" e o parceiro nasce em rascunho (sem página pública).
  const ativa = acoes.slice(acoes.indexOf("async function ativarParceiroDoAvaliador"), acoes.indexOf("export async function adminCriarAvaliacaoTeste"));
  assert.match(ativa, /status: "rascunho"/);
  assert.doesNotMatch(ativa, /status: "ativo"|publicado/);
});

test("E30: conta de teste não conta como avaliador ativo rumo aos 2 da chave", () => {
  assert.equal(contaComoAvaliadorAtivo({ status: "ativo", contaTeste: true }), false);
  assert.equal(contaComoAvaliadorAtivo({ status: "ativo", contaTeste: false }), true);
  assert.equal(contaComoAvaliadorAtivo({ status: "em_teste", contaTeste: false }), false);
  const tela = readFileSync(new URL("../../app/(dashboard)/admin/avaliadores/page.tsx", import.meta.url), "utf8");
  assert.match(tela, /avaliadoresAtivos: ativos/);
  assert.match(tela, /contaComoAvaliadorAtivo\(\{ status: c\.status, contaTeste:/);
});
