/*
  E1248 PR 1 — o termo em PDF sai sempre com a linha "Confirmação:", numa de três formas (ESPEC-E1248 v11, 8.2, texto
  1; M20): pelo morador, por falta de resposta, ou por decisão da equipe. Em texto de documento, "por falta de resposta"
  (nunca "por silêncio"). Um acerto anterior ao E1248 (sem a forma gravada) sai como hoje.
  Roda: node --test src/lib/fiscal/e1248-termo-confirmacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { conteudoDocumento, textoDocumento, type DadosDocumento } from "./documento.ts";

const m = (await import("../caucao/devolucao-maquina.ts")) as unknown as Record<string, unknown>;
const linha = (p: Record<string, unknown>) => {
  assert.equal(typeof m.linhaDeConfirmacao, "function", "linhaDeConfirmacao existe");
  return (m.linhaDeConfirmacao as (p: Record<string, unknown>) => string | null)(p);
};

const BASE: DadosDocumento = {
  tipo: "termo_devolucao_caucao",
  numero: "TDC-2026-000001",
  emitidoEm: "2026-12-06T15:00:00Z",
  locador: { nome: "Dono Um", doc: "123.456.789-00" },
  locatario: { nome: "Inquilina Dois", doc: "987.654.321-00" },
  imovelEndereco: "Rua das Flores 123, Uberlândia",
  contratoRef: "VN-CT-ABC123",
  periodoInicio: null,
  periodoFim: null,
  valor: 3200,
  encargos: [],
  caucaoTotal: 3200,
  confirmadoEm: "2026-12-02T17:45:00.000Z",
  conferirUrl: "https://vivanomads.com.br/conferir",
};

test("M20. pelo morador: \"pelo morador, em {DD/MM/AAAA HH:MM}.\"", () => {
  assert.equal(linha({ via: "morador", confirmadoEm: "2026-12-02T17:45:00.000Z" }), "pelo morador, em 02/12/2026 14:45.");
});

test("M20. por falta de resposta: o aviso, com a hora, e as regras da plataforma", () => {
  assert.equal(
    linha({ via: "falta_de_resposta", confirmadoEm: "2026-12-06T13:00:00.000Z", avisoEm: "2026-12-01T13:00:00.000Z" }),
    "por falta de resposta do morador no prazo de 5 dias contados do aviso de 01/12/2026 10:00, conforme as regras da plataforma.",
  );
});

test("M20. pela Central: o dia, o atendimento e a contestação", () => {
  assert.equal(
    linha({ via: "central", confirmadoEm: "2026-12-09T13:00:00.000Z", decididoEm: "2026-12-09T13:00:00.000Z", atendimento: "CH-2026-000901" }),
    "por decisão da equipe da Viva Nomads, em 09/12/2026, no atendimento CH-2026-000901, após contestação do morador.",
  );
});

test("um acerto anterior ao E1248 (sem a forma): nenhuma linha", () => {
  assert.equal(linha({ via: null, confirmadoEm: "2026-12-02T17:45:00.000Z" }), null);
});

test("M20. o termo traz a linha \"Confirmação:\"; sem a forma, sai como hoje", () => {
  const com = textoDocumento(conteudoDocumento({ ...BASE, confirmacao: "por falta de resposta do morador no prazo de 5 dias contados do aviso de 01/12/2026 10:00, conforme as regras da plataforma." } as DadosDocumento));
  assert.match(com, /Confirmação: por falta de resposta do morador no prazo de 5 dias contados do aviso de 01\/12\/2026 10:00, conforme as regras da plataforma\./);
  assert.doesNotMatch(com, /silêncio/i);
  assert.doesNotMatch(com, /O locatário confirmou o recebimento na plataforma/, "sem a confirmação do morador, o termo não diz que ele confirmou");
  const pelaCentral = textoDocumento(conteudoDocumento({ ...BASE, confirmacao: "por decisão da equipe da Viva Nomads, em 09/12/2026, no atendimento CH-2026-000901, após contestação do morador." } as DadosDocumento));
  assert.doesNotMatch(pelaCentral, /Confirmado pelo locatário em/, "a linha do quadro não diz que o locatário confirmou");
  const hoje = textoDocumento(conteudoDocumento(BASE));
  assert.doesNotMatch(hoje, /Confirmação:/);
  assert.match(hoje, /Confirmado pelo locatário em: 02\/12\/2026/);
  assert.match(hoje, /O locatário confirmou o recebimento na plataforma/);
});

test("emitirTermoDevolucao lê a forma da confirmação, a hora do aviso e o atendimento da decisão", () => {
  const f = readFileSync(new URL("./emitir.ts", import.meta.url), "utf8");
  const i = f.indexOf("export async function emitirTermoDevolucao(");
  const c = f.slice(i, f.indexOf("\nexport ", i + 1));
  assert.match(c, /confirmacao_via/);
  assert.match(c, /aviso_em/);
  assert.match(c, /central_decidido_em/);
  assert.match(c, /numero_publico/);
  assert.match(c, /linhaDeConfirmacao\(/);
  assert.match(c, /confirmacao: /);
});
