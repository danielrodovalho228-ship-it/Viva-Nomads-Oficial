/*
  E290 — guarda permanente de quem enxerga o link da chamada da visita por vídeo (revisão de 01/11, docs/e290-revisao-link-video.md).
  O que já tinha teste fica onde está (visitas-video.test.ts: hosts aceitos, RLS da 0148, link apagado no fim;
  visitas-passadas.test.ts: sem "Entrar na chamada" depois que passou). Aqui: as portas de leitura do servidor,
  o estado em que o cartão mostra o link e os destinatários dos e-mails.
  Roda: node --test src/lib/visitas/e290-link-acesso.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mudancaDeStatus } from "../visitas-video.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const acoes = ler("src/lib/data/visitas-video-actions.ts");
const corpoDe = (nome: string) => {
  const i = acoes.indexOf(`export async function ${nome}(`);
  assert.ok(i > 0, nome);
  const j = acoes.indexOf("\nexport ", i + 10);
  return acoes.slice(i, j > 0 ? j : undefined);
};

test("leitura pelo servidor: cada porta só devolve visitas das quais a sessão é parte", () => {
  assert.match(corpoDe("listVisitasDono"), /\.eq\("owner_id", user\.id\)/);
  assert.match(corpoDe("listMinhasVisitas"), /\.eq\("tenant_id", user\.id\)/);
  const conversa = corpoDe("visitaDaConversa");
  assert.match(conversa, /UUID\.test\(String\(propertyId\)\) \|\| !UUID\.test\(String\(outroId\)\)/);
  assert.match(conversa, /\.or\(`and\(owner_id\.eq\.\$\{user\.id\},tenant_id\.eq\.\$\{outroId\}\),and\(owner_id\.eq\.\$\{outroId\},tenant_id\.eq\.\$\{user\.id\}\)`\)/);
  const detalhe = corpoDe("visitaDetalhe");
  assert.match(detalhe, /const papel = r\.owner_id === user\.id \? "dono" : r\.tenant_id === user\.id \? "morador" : null;/);
  assert.match(detalhe, /if \(!papel\) return null;/);
  // A ação que grava o link também confere a parte antes de tudo.
  assert.match(corpoDe("responderVisita"), /if \(!quem\) return \{ ok: false, error: "Sem permissão\." \};/);
});

test("o link só nasce na confirmação ou na remarcação de visita por vídeo (nunca no pedido, nunca na presencial)", () => {
  const agora = new Date("2026-11-01T12:00:00Z");
  const horario = "2026-11-03T15:00:00Z";
  const link = "https://meet.google.com/abc-defg-hij";
  const conf = mudancaDeStatus("pedido", "dono", { acao: "confirmar", horario, link }, agora, { modalidade: "video" });
  assert.ok(conf.ok && conf.campos.link_chamada === link);
  const presencial = mudancaDeStatus("pedido", "dono", { acao: "confirmar", horario, link }, agora, { modalidade: "presencial" });
  assert.ok(presencial.ok && !("link_chamada" in presencial.campos), "presencial não grava link");
  // O morador não grava link: cancelar não traz link, e confirmar não é transição dele.
  const morador = mudancaDeStatus("pedido", "morador", { acao: "confirmar", horario, link }, agora, { modalidade: "video" });
  assert.equal(morador.ok, false);
});

test("o cartão só mostra o link com a visita CONFIRMADA (nem pedida, nem em remarcação) e antes de passar", () => {
  const cartao = ler("src/components/visitas/cartao-visita.tsx");
  const confirmada = cartao.indexOf('v.status === "confirmado" && v.horarioConfirmado ? (');
  const botao = cartao.indexOf('v.modalidade === "video" && v.linkChamada && !passou && (');
  const remarcar = cartao.indexOf(') : v.status === "remarcar" && v.horarioProposto ? (');
  assert.ok(confirmada > 0 && botao > confirmada && remarcar > botao, "o botão fica dentro do ramo da confirmada");
  assert.equal(cartao.split('data-testid="visita-link-chamada"').length - 1, 1, "um lugar só mostra o link");
});

test("e-mails: o da confirmação não leva o link; o da véspera vai só ao morador e ao dono da visita", () => {
  const confirma = corpoDe("responderVisita");
  assert.match(confirma, /avisarVisita\(admin, outro, "visita_confirmada", `Visita \$\{tipo\} confirmada para \$\{formatarHorarioBrasilia\(campos\.horario_confirmado\)\}\.`, endereco\);/);
  assert.doesNotMatch(confirma.slice(confirma.indexOf('"visita_confirmada"'), confirma.indexOf('"visita_confirmada"') + 200), /link/i);
  const avisos = ler("src/lib/visitas/avisos-servidor.ts");
  assert.match(avisos, /for \(const para of \[v\.tenant_id, v\.owner_id\]\) \{/);
});

test("a agenda e o painel de decisões não leem a coluna do link", () => {
  for (const f of ["src/lib/data/agenda-servidor.ts", "src/lib/data/painel-decisoes.ts"]) assert.doesNotMatch(ler(f), /link_chamada/, f);
});
