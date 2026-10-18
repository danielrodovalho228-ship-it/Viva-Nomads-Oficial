import { test } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";
import {
  classificarFalhaIa,
  iaCadastroLigada,
  motivoDoStatusFotos,
  textoDaResposta,
  MENSAGEM_FALHA_IA,
  RespostaIaIncompleta,
} from "./falha-ia.ts";

const h = new Headers();
const corpo = (type: string, message: string) => ({ type: "error", error: { type, message } });

test("p22 — imagem acima do limite da API (400) e pedido grande demais (413) → 'arquivo grande demais'", () => {
  const e400 = new Anthropic.BadRequestError(400, corpo("invalid_request_error", "image exceeds 5 MB maximum"), "image exceeds 5 MB maximum", h);
  assert.deepEqual(classificarFalhaIa(e400), { motivo: "arquivo_grande", status: 400, tipo: "invalid_request_error" });
  const e413 = Anthropic.APIError.generate(413, corpo("request_too_large", "Request exceeds the maximum size"), "too large", h);
  assert.equal(classificarFalhaIa(e413).motivo, "arquivo_grande");
  assert.match(MENSAGEM_FALHA_IA.arquivo_grande, /arquivo grande demais/i);
});

test("p22 — outros 400 (ex.: parâmetro recusado), 401, 429, 529 e rede → 'leitura indisponível — tente de novo', com status e tipo", () => {
  const schema = new Anthropic.BadRequestError(400, corpo("invalid_request_error", "output_config.format: unsupported keyword"), "unsupported keyword", h);
  assert.deepEqual(classificarFalhaIa(schema), { motivo: "indisponivel", status: 400, tipo: "invalid_request_error" });
  assert.deepEqual(classificarFalhaIa(Anthropic.APIError.generate(401, corpo("authentication_error", "invalid x-api-key"), "x", h)), {
    motivo: "indisponivel",
    status: 401,
    tipo: "authentication_error",
  });
  assert.equal(classificarFalhaIa(Anthropic.APIError.generate(429, corpo("rate_limit_error", "slow down"), "x", h)).status, 429);
  assert.equal(classificarFalhaIa(Anthropic.APIError.generate(529, corpo("overloaded_error", "Overloaded"), "x", h)).motivo, "indisponivel");
  assert.deepEqual(classificarFalhaIa(new Anthropic.APIConnectionError({ message: "fetch failed" })), { motivo: "indisponivel", status: null, tipo: "conexao" });
  assert.deepEqual(classificarFalhaIa(new Anthropic.APIConnectionTimeoutError()), { motivo: "indisponivel", status: null, tipo: "tempo_esgotado" });
  assert.match(MENSAGEM_FALHA_IA.indisponivel, /indisponível agora — tente de novo/);
});

test("p22 — resposta cortada (max_tokens) nunca chega ao JSON.parse; recusa e JSON inválido → 'imagem ilegível'", () => {
  const msg = (stop: Anthropic.Message["stop_reason"], texto: string) => ({ stop_reason: stop, content: [{ type: "text", text: texto, citations: null }] }) as Pick<Anthropic.Message, "content" | "stop_reason">;
  assert.throws(() => textoDaResposta(msg("max_tokens", '{"numero":"12')), (e) => e instanceof RespostaIaIncompleta && e.motivo === "indisponivel" && e.tipo === "max_tokens");
  assert.throws(() => textoDaResposta(msg("refusal", "")), (e) => e instanceof RespostaIaIncompleta && e.motivo === "ilegivel");
  assert.equal(textoDaResposta(msg("end_turn", '{"ok":true}')), '{"ok":true}');
  let erro: unknown;
  try {
    JSON.parse("{corrompido");
  } catch (e) {
    erro = e;
  }
  assert.deepEqual(classificarFalhaIa(erro), { motivo: "ilegivel", status: 200, tipo: "json_invalido" });
  assert.equal(classificarFalhaIa(new RespostaIaIncompleta("max_tokens")).tipo, "max_tokens");
  assert.match(MENSAGEM_FALHA_IA.ilegivel, /imagem ilegível/i);
});

test("p22 — status da rota das fotos → motivo da tela; IA ligada só com flag E chave (ou no laboratório)", () => {
  assert.equal(motivoDoStatusFotos(429, false), "limite");
  assert.equal(motivoDoStatusFotos(413, false), "arquivo_grande");
  assert.equal(motivoDoStatusFotos(422, false), "ilegivel");
  assert.equal(motivoDoStatusFotos(503, true), "desligada");
  assert.equal(motivoDoStatusFotos(503, false), "indisponivel");
  assert.equal(iaCadastroLigada({ simulado: false, flag: false, chave: true }), false, "a chave existe na Vercel, a flag não: desligada");
  assert.equal(iaCadastroLigada({ simulado: false, flag: true, chave: false }), false);
  assert.equal(iaCadastroLigada({ simulado: false, flag: true, chave: true }), true);
  assert.equal(iaCadastroLigada({ simulado: true, flag: false, chave: false }), true);
});
