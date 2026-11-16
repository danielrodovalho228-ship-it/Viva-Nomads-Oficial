/*
  E966 (parte 2) — avisos CRÍTICOS sem caminho de resolução: a faixa vermelha do sino só some com o aviso resolvido
  (E444/E445), e sete críticos nunca eram resolvidos — ficavam para sempre. Para cada um: o aviso passa a carregar o
  objeto (ref_id) e a ação que resolve o problema marca "resolvido_em" nele.
  Lista tirada do código (CRITICOS + POR_PAPEL em avisos.ts, menos os quatro que já tinham ACAO_RESOLVE e a proposta
  da parte 1). Roda: node --test src/lib/notifications/e966-criticos-resolvem.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { EVENTOS_DA_MANUTENCAO_ABERTA, RESOLUCAO_DO_CRITICO, eventosCriticos, prioridadeDoAviso } from "./avisos.ts";

const ler = (p: string) => readFileSync(p, "utf8");
/** Corpo da função exportada `nome` no arquivo (até o primeiro "\n}\n" depois dela). */
function corpo(p: string, assinatura: string): string {
  const s = ler(p);
  const i = s.indexOf(assinatura);
  assert.ok(i >= 0, `${assinatura} não achada em ${p}`);
  return s.slice(i, s.indexOf("\n}\n", i));
}

test("E966 — todo evento crítico (para qualquer papel) tem caminho de resolução escrito", () => {
  const sem = eventosCriticos().filter((e) => !RESOLUCAO_DO_CRITICO[e]);
  assert.deepEqual(sem, []);
  assert.equal(prioridadeDoAviso("manutencao_nova", "dono"), "critico");
});

test("E966 — estadia_encerramento_pedido: concluir o encerramento resolve o aviso do contrato", () => {
  const fn = corpo("src/lib/data/estadia-actions.ts", "export async function atualizarPedidoEncerramento");
  const concluido = fn.slice(fn.indexOf('if (status === "concluido")'));
  assert.match(concluido, /resolverAvisosDoObjeto\(\{ eventos: \["estadia_encerramento_pedido"\], refId: pedido\.contrato_id \}\)/);
});

test("E966 — documento_recusado: o aviso carrega o imóvel; reenviar ou ter tudo aprovado o resolve", () => {
  const aviso = corpo("src/lib/data/aviso-decisao-documento.ts", "export async function avisarDecisoesDoImovel");
  assert.match(aviso, /refId: propertyId,/);
  assert.match(aviso, /email\.evento === "documento_aprovado"\) await resolverAvisosDoObjeto\(\{ eventos: \["documento_recusado"\], refId: propertyId, usuarioId: ownerId \}\)/);
  const envio = corpo("src/lib/data/actions.ts", "export async function enviarDocumentoParaConferencia");
  assert.match(envio, /resolverAvisosDoObjeto\(\{ eventos: \["documento_recusado"\], refId: propertyId, usuarioId: user\.id \}\)/);
});

test("E966 — checklist_recusado: nenhum código emite o evento (a recusa sai como documento_recusado)", () => {
  // Se alguém passar a emiti-lo, este teste cai e pede o caminho de resolução junto.
  const achados = execSync(`grep -rnE 'event: "checklist_recusado"|"checklist_recusado" *:' src --include=*.ts --include=*.tsx || true`, { encoding: "utf8" })
    .split("\n")
    .filter((l) => l && !/\.test\.ts|eventos-email\.ts|matriz-notificacoes\.ts|imagens-email\.ts|avisos\.ts/.test(l));
  assert.deepEqual(achados, []);
  assert.ok(RESOLUCAO_DO_CRITICO.checklist_recusado);
});

test("E966 — manutencao_atrasada: o aviso carrega a ordem; a resposta do dono o resolve", () => {
  assert.match(ler("src/app/api/cron/atendimento/route.ts"), /event: "manutencao_atrasada",[\s\S]{0,400}refId: so\.id,/);
  assert.ok(EVENTOS_DA_MANUTENCAO_ABERTA.includes("manutencao_atrasada"));
  const status = corpo("src/lib/data/manutencao-actions.ts", "export async function mudarStatusSolicitacao");
  assert.match(status, /papel === "proprietario" \|\| novo === "resolvido"\) await resolverAvisosDoObjeto\(\{ eventos: EVENTOS_DA_MANUTENCAO_ABERTA, refId: id, usuarioId: ordem\.owner_id \}\)/);
  const msg = corpo("src/lib/data/manutencao-actions.ts", "export async function responderSolicitacao");
  assert.match(msg, /alvo\.papel === "proprietario"\) await resolverAvisosDoObjeto\(\{ eventos: EVENTOS_DA_MANUTENCAO_ABERTA, refId: id, usuarioId: s\.uid \}\)/);
  const prov = corpo("src/lib/data/manutencao-actions.ts", "export async function marcarSolucaoProvisoria");
  assert.match(prov, /resolverAvisosDoObjeto\(\{ eventos: EVENTOS_DA_MANUTENCAO_ABERTA, refId: id, usuarioId: s\.uid \}\)/);
});

test("E966 — manutencao_nova (crítico do dono): o aviso carrega a ordem e entra no mesmo caminho", () => {
  assert.match(corpo("src/lib/atendimento/servidor.ts", "export async function avisarProprietarioManutencao"), /refId: ordem\.serviceOrderId,/);
  assert.ok(EVENTOS_DA_MANUTENCAO_ABERTA.includes("manutencao_nova"));
});

test("E966 — vistoria_fora_da_busca: o aviso carrega o imóvel; liberar a segurança grave o resolve", () => {
  assert.match(corpo("src/lib/vistoria/servidor.ts", "export async function avisar("), /refId: ref\?\.propertyId,/);
  const lib = corpo("src/lib/vistoria/laudo-servidor.ts", "export async function liberar(");
  assert.match(lib, /motivos\.includes\("seguranca_grave"\) && \(data \?\? \[\]\)\.length\) await resolverAvisosDoObjeto\(\{ eventos: \["vistoria_fora_da_busca"\], refId: propertyId \}\)/);
});

test("E966 — pedido_confirmar_telefone: o aviso carrega a pessoa; confirmar o telefone o resolve", () => {
  assert.match(ler("src/lib/data/pedidos-admin.ts"), /event: "pedido_confirmar_telefone",[\s\S]{0,400}refId: inqId,/);
  assert.match(
    ler("src/lib/data/telefone-actions.ts"),
    /verificado_em: agora[\s\S]{0,300}resolverAvisosDoObjeto\(\{ eventos: \["pedido_confirmar_telefone"\], refId: s\.user\.id, usuarioId: s\.user\.id \}\)/
  );
});

test("E966 — parceiro_pedido_novo (crítico do parceiro): o aviso carrega o pedido; toda mudança de estado o resolve", () => {
  assert.equal(prioridadeDoAviso("parceiro_pedido_novo", "parceiro"), "critico");
  assert.match(corpo("src/lib/parceiros/pedido-servidor.ts", "export async function avisar("), /refId: pedidoId,/);
  const m = corpo("src/lib/parceiros/pedido-actions.ts", "async function mudar(");
  assert.match(m, /\.eq\("status", c\.p\.status\)[\s\S]*resolverAvisosDoObjeto\(\{ eventos: \["parceiro_pedido_novo"\], refId: c\.p\.id \}\)/);
});

test("E966 — resolverAvisosDoObjeto só marca pendentes do objeto e dos eventos dados", () => {
  const fn = corpo("src/lib/notifications/avisos-servidor.ts", "export async function resolverAvisosDoObjeto");
  assert.match(fn, /\.eq\("ref_id", p\.refId\)/);
  assert.match(fn, /\.in\("evento", \[\.\.\.p\.eventos\]\)/);
  assert.match(fn, /\.is\("resolvido_em", null\)/);
  assert.match(fn, /!REF_RE\.test\(p\.refId\)/);
});
