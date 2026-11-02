/*
  PRESERVAR O VÍNCULO ATUAL — NUNCA APAGAR (ordem do Daniel, 02/11). Teste PERMANENTE dos 3 casos:
  1) um pedido novo nunca apaga, substitui nem rebaixa o vínculo/selo ativo;
  2) recusa ou expiração do pedido novo mantêm o vínculo anterior;
  3) a troca só acontece com pedido explícito E confirmado pela própria pessoa.
  Cobre o vínculo por e-mail (vinculo_profissional, regras puras + guardas do servidor) e o fluxo irmão do comprovante
  (triagem_vinculos: aprovado e válido não aceita envio novo). Não remover nem afrouxar sem ordem do Daniel.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { camposDaConfirmacao, camposDaRecusa, camposDoPedido, dominioDoPedido, seloAtivo, type LinhaVinculo } from "./regras-pedido.ts";
import { conferirCodigo, hashDoCodigo, MAX_TENTATIVAS } from "./codigo.ts";
import { estadoVinculo, podeEnviar } from "../triagem/vinculo.ts";

type Linha = LinhaVinculo & { codigo_hash: string; expira_em: string; tentativas: number };
const UID = "00000000-0000-0000-0000-000000000001";
const agora = new Date("2026-11-02T12:00:00Z");
const daqui = (min: number) => new Date(agora.getTime() + min * 60_000).toISOString();

/** Estado com selo confirmado em empresa-a.com.br. */
function comSelo(): Linha {
  return { dominio: "empresa-a.com.br", confirmado_em: "2026-10-01T10:00:00Z", pedido_dominio: null, codigo_hash: "x", expira_em: daqui(-60 * 24), tentativas: MAX_TENTATIVAS };
}
/** Aplica a gravação como o banco faria (update parcial da linha). */
const aplica = (l: Linha, campos: Partial<Linha>): Linha => ({ ...l, ...campos });

test("caso 1: pedido novo (outro domínio) não apaga, não substitui e não rebaixa o selo ativo", () => {
  const antes = comSelo();
  const campos = camposDoPedido(antes, "empresa-b.com.br", hashDoCodigo(UID, "123456"), daqui(15));
  assert.equal("dominio" in campos, false, "com selo ativo, o pedido não escreve dominio");
  assert.equal("confirmado_em" in campos, false, "o pedido nunca escreve confirmado_em");
  const depois = aplica(antes, campos);
  assert.equal(seloAtivo(depois), "empresa-a.com.br");
  assert.equal(depois.confirmado_em, antes.confirmado_em);
  assert.equal(depois.pedido_dominio, "empresa-b.com.br");
});

test("caso 1b: pedido novo para o MESMO domínio também mantém o selo", () => {
  const antes = comSelo();
  const depois = aplica(antes, camposDoPedido(antes, "empresa-a.com.br", hashDoCodigo(UID, "123456"), daqui(15)));
  assert.equal(seloAtivo(depois), "empresa-a.com.br");
  assert.equal(depois.confirmado_em, antes.confirmado_em);
});

test("caso 2a: código recusado (errado até bloquear) mantém o vínculo anterior", () => {
  let l = aplica(comSelo(), camposDoPedido(comSelo(), "empresa-b.com.br", hashDoCodigo(UID, "123456"), daqui(15)));
  for (let i = 0; i < MAX_TENTATIVAS; i++) {
    const r = conferirCodigo(UID, "999999", { codigoHash: l.codigo_hash, expiraEm: l.expira_em, tentativas: l.tentativas }, agora);
    assert.equal(r, "errado");
    l = aplica(l, camposDaRecusa(l.tentativas));
  }
  assert.equal(conferirCodigo(UID, "123456", { codigoHash: l.codigo_hash, expiraEm: l.expira_em, tentativas: l.tentativas }, agora), "bloqueado");
  assert.equal(seloAtivo(l), "empresa-a.com.br");
  assert.equal(l.confirmado_em, comSelo().confirmado_em);
});

test("caso 2b: código expirado mantém o vínculo anterior", () => {
  const l = aplica(comSelo(), camposDoPedido(comSelo(), "empresa-b.com.br", hashDoCodigo(UID, "123456"), daqui(15)));
  const depois15 = new Date(agora.getTime() + 16 * 60_000);
  assert.equal(conferirCodigo(UID, "123456", { codigoHash: l.codigo_hash, expiraEm: l.expira_em, tentativas: l.tentativas }, depois15), "expirado");
  assert.equal(seloAtivo(l), "empresa-a.com.br");
});

test("caso 3: só a confirmação explícita do código troca o selo", () => {
  const l = aplica(comSelo(), camposDoPedido(comSelo(), "empresa-b.com.br", hashDoCodigo(UID, "123456"), daqui(15)));
  assert.equal(conferirCodigo(UID, "123456", { codigoHash: l.codigo_hash, expiraEm: l.expira_em, tentativas: l.tentativas }, agora), "ok");
  const depois = aplica(l, camposDaConfirmacao(l, agora));
  assert.equal(seloAtivo(depois), "empresa-b.com.br");
  assert.equal(depois.pedido_dominio, null);
  assert.equal(depois.tentativas, MAX_TENTATIVAS, "código consumido");
});

test("sem selo: o primeiro pedido grava o domínio e nada vira selo antes da confirmação", () => {
  const campos = camposDoPedido(null, "empresa-b.com.br", "h", daqui(15));
  assert.equal(campos.dominio, "empresa-b.com.br");
  const l: Linha = { dominio: "empresa-b.com.br", confirmado_em: null, ...campos };
  assert.equal(seloAtivo(l), null);
  // Linha antiga (antes da 0283, sem pedido_dominio): o código confirma o próprio dominio.
  assert.equal(dominioDoPedido({ dominio: "antiga.com.br", confirmado_em: null }), "antiga.com.br");
});

test("servidor: pedirVinculo só grava por camposDoPedido, nunca escreve confirmado_em e não age com leitura falha", () => {
  const src = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
  const i = src.indexOf("export async function pedirVinculo(");
  const f = src.slice(i, src.indexOf("\n}\n", i));
  assert.doesNotMatch(f, /confirmado_em:/, "o pedido nunca escreve o selo");
  assert.doesNotMatch(f, /\.upsert\(/);
  const guarda = f.indexOf("if (erroAtual) return { ok: false, error: ERRO_GERAL };");
  assert.ok(guarda > 0 && guarda < f.indexOf("camposDoPedido("));
  // confirmarVinculo: a recusa só conta tentativa; a troca só em camposDaConfirmacao.
  const j = src.indexOf("export async function confirmarVinculo(");
  const g = src.slice(j, src.indexOf("\n}\n", j));
  assert.match(g, /\.update\(camposDaRecusa\(tentativas\)\)/);
  assert.match(g, /\.update\(camposDaConfirmacao\(p as LinhaVinculo, new Date\(\)\)\)/);
  assert.equal((src.match(/camposDaConfirmacao\(/g) ?? []).length, 1, "um único ponto troca o selo");
});

test("fluxo irmão (comprovante de vínculo): aprovado e válido não aceita envio novo; recusa não toca o aprovado", () => {
  const aprovado = { tipo: "holerite", status: "aprovado", motivo: null, decidido_em: "2026-10-01T00:00:00Z", valido_ate: "2027-10-01T00:00:00Z", enviado_em: "2026-09-30T00:00:00Z" };
  assert.equal(estadoVinculo(aprovado as never, agora), "aprovado");
  assert.equal(podeEnviar("aprovado"), false);
  const rota = readFileSync(new URL("../../app/api/upload/triagem-vinculo/route.ts", import.meta.url), "utf8");
  assert.match(rota, /if \(!podeEnviar\(estadoVinculo\(/);
  // Só o PENDENTE é substituído por um envio novo; a decisão só muda linha pendente.
  assert.match(rota, /\.delete\(\)\.eq\("id", anterior\.id\)\.eq\("status", "pendente"\)/);
  const acoes = readFileSync(new URL("../data/triagem-actions.ts", import.meta.url), "utf8");
  assert.match(acoes, /\.update\(mudanca\)\.eq\("id", id\)\.eq\("status", "pendente"\)/);
});
