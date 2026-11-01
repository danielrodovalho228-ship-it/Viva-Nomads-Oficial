/*
  Auditoria de erros e estados vazios — achado nº 2: "Reativar anúncio" mostrava o texto cru do banco (error.message,
  em inglês) e, sem conexão, a ação rejeitava e derrubava a tela. Agora: o servidor traduz (erroBancoPT, que mantém as
  mensagens dos nossos gatilhos de publicação) e a tela trata a queda de rede (textoDoErro). Pausar segue o mesmo padrão.
  Roda: node --test src/lib/anuncio/reativar-erro.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { erroBancoPT } from "../erros-banco.ts";
import { MSG_SEM_CONEXAO, textoDoErro } from "../erro-de-rede.ts";
import { MSG_PAUSAR_FALHOU, MSG_REATIVAR_FALHOU } from "./pausa.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("servidor: erro técnico do banco vira frase em português; o gatilho de publicação (nosso) passa", () => {
  // RLS e outros erros do Postgres/PostgREST: nunca o texto em inglês.
  const rls = erroBancoPT({ code: "42501", message: 'new row violates row-level security policy for table "properties"' }, MSG_REATIVAR_FALHOU);
  assert.equal(rls, "Você não tem permissão para esta ação.");
  const desconhecido = erroBancoPT({ code: "XX000", message: "canceling statement due to statement timeout" }, MSG_REATIVAR_FALHOU);
  assert.equal(desconhecido, MSG_REATIVAR_FALHOU);
  // Nenhuma linha atualizada (sem erro): a frase padrão.
  assert.equal(erroBancoPT(null, MSG_REATIVAR_FALHOU), MSG_REATIVAR_FALHOU);
  // A mensagem do gatilho de publicação (0210) é nossa e diz o que falta: passa como está.
  const gatilho = "Para publicar, confirme o padrão mínimo de conforto.";
  assert.equal(erroBancoPT({ code: "42501", message: gatilho }, MSG_REATIVAR_FALHOU), gatilho);
  for (const t of [rls, desconhecido]) assert.doesNotMatch(t, /violates|policy|statement|timeout/i);
});

test("tela: sem conexão, a frase de conexão; outro erro técnico, a frase de reativar/pausar", () => {
  assert.equal(textoDoErro(new TypeError("Failed to fetch"), MSG_REATIVAR_FALHOU), MSG_SEM_CONEXAO);
  assert.equal(textoDoErro(new TypeError("Load failed"), MSG_PAUSAR_FALHOU), MSG_SEM_CONEXAO);
  assert.equal(textoDoErro(new SyntaxError("Unexpected end of JSON input"), MSG_REATIVAR_FALHOU), MSG_REATIVAR_FALHOU);
  assert.equal(MSG_REATIVAR_FALHOU, "Não foi possível reativar agora. Tente de novo.");
  assert.equal(MSG_PAUSAR_FALHOU, "Não foi possível pausar agora. Tente de novo.");
});

test("o servidor não devolve mais error.message cru ao reativar", () => {
  const acoes = ler("src/lib/data/actions.ts");
  const fn = acoes.slice(acoes.indexOf("export async function reativarAnuncio"), acoes.indexOf("export async function reativarAnuncio") + 3000);
  assert.match(fn, /erro: erroBancoPT\(error, MSG_REATIVAR_FALHOU\)/);
  assert.doesNotMatch(fn, /error\?\.message|error\.message/);
});

test("a tela trata a queda de rede em reativar e pausar (try/catch com textoDoErro), sem derrubar a página", () => {
  const tela = ler("src/components/anuncio/estado-anuncio.tsx");
  assert.match(tela, /try \{\n\s*r = await reativarAnuncio\(id\);\n\s*\} catch \(e\) \{[\s\S]{0,120}textoDoErro\(e, MSG_REATIVAR_FALHOU\)/);
  assert.match(tela, /try \{\n\s*r = await pausarAnuncio\(id\);\n\s*\} catch \(e\) \{\n\s*return setAviso\(\{ ok: false, texto: textoDoErro\(e, MSG_PAUSAR_FALHOU\) \}\);/);
});
