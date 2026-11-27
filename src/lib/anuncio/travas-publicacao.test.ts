/*
  E699: as travas da publicação (confirmação de identidade e documento do imóvel) aparecem desde o PASSO 1, não só no passo 10.
  Roda: node --test src/lib/anuncio/travas-publicacao.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { estadoIdentidadeParaTrava, travasDePublicacao } from "./travas-publicacao.ts";

test("sem nada feito: as duas travas aparecem como 'falta', com o aviso de que dá para enviar quando quiser", () => {
  const t = travasDePublicacao({ identidade: "pendente", documento: "nenhum" });
  assert.deepEqual(t.itens.map((i) => [i.chave, i.estado]), [["identidade", "falta"], ["documento", "falta"]]);
  assert.equal(t.mostrar, true);
  assert.match(t.itens[0].rotulo, /Confirmação de identidade/);
  assert.match(t.itens[1].rotulo, /Documento do imóvel/);
});

test("identidade confirmada e documento aprovado: nada a mostrar (o cartão some)", () => {
  const t = travasDePublicacao({ identidade: "ok", documento: "aprovado" });
  assert.equal(t.mostrar, false);
  assert.ok(t.itens.every((i) => i.estado === "ok"));
});

test("documento enviado e em análise não é 'falta': é 'em análise'; documento a corrigir é 'falta'", () => {
  assert.equal(travasDePublicacao({ identidade: "ok", documento: "revisao" }).itens[1].estado, "em_analise");
  assert.equal(travasDePublicacao({ identidade: "ok", documento: "corrija" }).itens[1].estado, "falta");
  assert.equal(travasDePublicacao({ identidade: "ok", documento: "revisao" }).mostrar, true);
});

test("enquanto o estado da identidade carrega, não afirma 'falta' (evita piscar)", () => {
  const t = travasDePublicacao({ identidade: "carregando", documento: "aprovado" });
  assert.equal(t.itens[0].estado, "carregando");
  assert.equal(t.mostrar, false);
});

test("o estado da identidade vem do mesmo critério do passo 10", () => {
  assert.equal(estadoIdentidadeParaTrava(null), "carregando");
  assert.equal(estadoIdentidadeParaTrava({ identidade: { estado: "confirmada" }, temCpf: true }), "ok");
  assert.equal(estadoIdentidadeParaTrava({ identidade: { estado: "nao_confirmada" }, temCpf: false }), "sem_cpf");
  assert.equal(estadoIdentidadeParaTrava({ identidade: { estado: "nao_confirmada" }, temCpf: true }), "pendente");
});

test("o passo 1 do cadastro mostra o cartão das travas", () => {
  const src = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");
  const i = src.indexOf("{step === ETAPA.tipo && (");
  assert.ok(i > 0);
  assert.match(src.slice(i, i + 900), /<TravasDePublicacao documento=\{docEstado\} \/>/);
});

// ── E699 resíduos ────────────────────────────────────────────────────────────────────────────────────────────
const ler = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

test("E699 (c): a trava de identidade que falta traz o caminho de resolução (CPF na Conta; senão a verificação)", () => {
  const pendente = travasDePublicacao({ identidade: "pendente", documento: "aprovado" }).itens[0];
  assert.equal(pendente.estado, "falta");
  assert.equal(pendente.href, "/dashboard/verificacao");
  const semCpf = travasDePublicacao({ identidade: "sem_cpf", documento: "aprovado" }).itens[0];
  assert.equal(semCpf.href, "/dashboard/conta/dados#documento");
  // Confirmada: nada a resolver, sem link.
  assert.equal(travasDePublicacao({ identidade: "ok", documento: "nenhum" }).itens[0].href, undefined);
});

test("E699 (d): enquanto confere ou quando a conferência falha, a trava NÃO parece pendente", () => {
  const carregando = travasDePublicacao({ identidade: "carregando", documento: "nenhum" }).itens[0];
  assert.equal(carregando.estado, "carregando");
  assert.match(carregando.detalhe ?? "", /conferindo/);
  const indisponivel = travasDePublicacao({ identidade: "indisponivel", documento: "nenhum" }).itens[0];
  assert.equal(indisponivel.estado, "carregando");
  assert.match(indisponivel.detalhe ?? "", /não deu para conferir/);
  assert.equal(indisponivel.href, "/dashboard/conta/seguranca");
  assert.equal(estadoIdentidadeParaTrava(null, true), "indisponivel");
  // A resposta do servidor sempre vence a falha anterior.
  assert.equal(estadoIdentidadeParaTrava({ identidade: { estado: "confirmada" }, temCpf: true }, true), "ok");
});

test("E699 (d): o hook diz quando a leitura do estado falhou, e o cartão usa isso", () => {
  const hook = ler("lib/identidade/use-estado-identidade.ts");
  assert.match(hook, /indisponivel/);
  const cartao = ler("app/(dashboard)/dashboard/imoveis/novo/travas-de-publicacao.tsx");
  assert.match(cartao, /const \{ situacao, indisponivel \} = useEstadoIdentidade\(\);/);
  assert.match(cartao, /estadoIdentidadeParaTrava\(situacao, indisponivel\)/);
  assert.match(cartao, /i\.href/);
});

test("E699 (b): a Qualificação (antes do Passo 1) mostra o cartão das travas", () => {
  const qual = ler("app/(dashboard)/dashboard/imoveis/novo/qualificacao.tsx");
  assert.match(qual, /travas\?: React\.ReactNode;/);
  assert.match(qual, /\{p\.travas && <div className="mt-4" data-testid="qualificacao-travas">\{p\.travas\}<\/div>\}/);
  const page = ler("app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  const i = page.indexOf("<Qualificacao");
  assert.ok(i > 0);
  assert.match(page.slice(i, i + 400), /travas=\{<TravasDePublicacao documento=\{docEstado\} \/>\}/);
});

test("E699 (a): /dashboard/imoveis mostra a trava de identidade em 'Falta para publicar', com link", () => {
  const cli = ler("app/(dashboard)/dashboard/imoveis/imoveis-client.tsx");
  assert.match(cli, /useEstadoIdentidade/);
  assert.match(cli, /pendencia-identidade/);
  assert.match(cli, /faltaIdentidade/);
});
