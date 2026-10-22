/*
  Guarda de privacidade do perfil público (Prompt 43, item 2): a rota pública /proprietario/[id] e o que ela lê nunca
  trazem CPF/CNPJ, telefone nem e-mail. Lê o código e a função do banco (0149) — sem banco.
  Roda: node --test src/lib/data/perfil-publico-privacidade.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PRIVADO = /\b(cpf|cnpj|cpf_cnpj|documento|phone|telefone|celular|whatsapp|email)\b/i;
const semComentario = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/--.*$/gm, "");

test("a função pública do banco (0149) só devolve nome curto, foto, cidade, bio, idiomas e números", () => {
  const sql = readFileSync("supabase/migrations/0149_perfil_publico_proprietario.sql", "utf8");
  const colunas = sql.match(/returns table \(([\s\S]*?)\)\s*language/i)?.[1] ?? "";
  assert.ok(colunas.includes("nome_curto"), "achou o retorno da função");
  for (const c of colunas.split(",").map((x) => x.trim().split(/\s+/)[0])) {
    if (c === "email_confirmado") continue; // só o selo (sim/não), nunca o endereço
    assert.doesNotMatch(c, PRIVADO, `coluna pública ${c}`);
  }
});

test("o carregador e a página pública não pedem nem mostram dado privado", () => {
  const dados = semComentario(readFileSync("src/lib/data/perfil-proprietario.ts", "utf8"));
  const tipo = dados.match(/export interface PerfilProprietario \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.ok(tipo.includes("nome"), "achou o tipo público");
  assert.doesNotMatch(tipo, PRIVADO, "PerfilProprietario sem campo privado");
  for (const sel of dados.matchAll(/\.select\("([^"]*)"\)/g)) assert.doesNotMatch(sel[1], PRIVADO, `select ${sel[1]}`);
  const pagina = semComentario(readFileSync("src/app/(public)/proprietario/[id]/page.tsx", "utf8"));
  assert.doesNotMatch(pagina, /\.(cpf|cpf_cnpj|phone|telefone|email)\b/, "a página não lê campo privado");
  assert.doesNotMatch(pagina, /from\("profiles"\)/, "a página não lê a tabela profiles direto");
});

test("'Seu perfil público' declara o que nunca aparece", () => {
  const t = readFileSync("src/components/account/seu-perfil-publico.tsx", "utf8");
  assert.match(t, /NUNCA_APARECE/);
  for (const p of ["CPF", "telefone", "e-mail"]) assert.match(t, new RegExp(p, "i"));
});
