/*
  Travas das ações da Viva (out/2026): e-mail só para o cadastrado da conta
  conectada; 3 envios de cada tipo por conta a cada 24h; lembrete ao dono 1×/24h
  por ordem de serviço; toda ação registrada no chamado; selo de resposta automática.
  Roda: node --test tests/atendimento/viva-travas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FERRAMENTAS_VIVA as FERRAMENTAS } from "../../src/lib/atendimento/viva-prompt.ts";

const ler = (p: string) => readFileSync(new URL(`../../src/${p}`, import.meta.url), "utf8");
const servidor = ler("lib/atendimento/viva-servidor.ts");
const trecho = (nome: string) => {
  const i = servidor.indexOf(`    ${nome}: async`);
  assert.ok(i >= 0, nome);
  return servidor.slice(i, servidor.indexOf("\n    },", i));
};

test("envio para outro e-mail é impossível: as ferramentas não recebem endereço", () => {
  for (const nome of ["reenviar_email_confirmacao", "enviar_link_redefinir_senha"]) {
    const f = FERRAMENTAS.find((x) => x.name === nome)!;
    assert.deepEqual(Object.keys((f.input_schema as { properties?: object }).properties ?? {}), [], `${nome} sem parâmetros`);
    assert.match(f.description, /JÁ CADASTRADO da conta conectada/);
  }
});

test("só conta conectada: visitante sem login recebe orientação, e o e-mail vem do cadastro (profiles)", () => {
  assert.match(servidor, /async function emailDaConta[\s\S]*?if \(!c\.usuario_id\) return \{ email: null, userId: null \}/);
  assert.doesNotMatch(servidor, /visitante_email[^\n]*resetPasswordForEmail|emailDoChamado/);
  for (const nome of ["reenviar_email_confirmacao", "enviar_link_redefinir_senha"]) {
    assert.match(trecho(nome), /emailDaConta\(admin, c\)/);
    assert.match(trecho(nome), /SEM_LOGIN_EMAIL/);
  }
});

test("limite diário por conta: 3 de cada tipo; lembrete ao dono 1×/24h por ordem de serviço", () => {
  assert.match(servidor, /LIMITE_ACOES_VIVA = \{ reenvio: 3, senha: 3, lembrete: 1 \}/);
  assert.match(trecho("reenviar_email_confirmacao"), /consumirLimite\(`viva:reenvio:\$\{userId\}`, LIMITE_ACOES_VIVA\.reenvio, DIA\)/);
  assert.match(trecho("enviar_link_redefinir_senha"), /consumirLimite\(`viva:senha:\$\{userId\}`, LIMITE_ACOES_VIVA\.senha, DIA\)/);
  assert.match(trecho("lembrar_proprietario"), /consumirLimite\(`viva:lembrete:os:\$\{so\.id\}`, LIMITE_ACOES_VIVA\.lembrete, DIA\)/);
});

test("toda ação fica registrada no chamado", () => {
  for (const [nome, acao] of [
    ["reenviar_email_confirmacao", "viva_reenvio_confirmacao"],
    ["enviar_link_redefinir_senha", "viva_link_senha"],
    ["abrir_ordem_manutencao", "viva_ordem_manutencao"],
    ["lembrar_proprietario", "viva_lembrete_dono"],
  ]) assert.match(trecho(nome), new RegExp(`registrarAcaoViva\\(admin, c, "${acao}"`), nome);
});

test("trocar e-mail da conta: a Viva explica e passa para a equipe", () => {
  assert.match(ler("lib/atendimento/viva-prompt.ts"), /trocar o e-mail da conta, explique o caminho e chame escalar_humano/);
});

test("selo 'Resposta automática da Viva Nomads' e 'Falar com uma pessoa' em toda resposta da Viva", () => {
  const ajuda = ler("components/ajuda/central-ajuda.tsx");
  assert.match(ajuda, /ia: "Viva \(assistente virtual\) · Resposta automática da Viva Nomads"/);
  assert.match(ajuda, /m\.autor === "ia" && aberto[\s\S]{0,900}Falar com uma pessoa/);
});
