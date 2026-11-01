import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ESCOPO_EXCLUIR_CONTA, ESCOPO_EXPIRACAO_24H, ESCOPO_SAIR, ESCOPO_SAIR_DE_TODOS, TEXTO_SAIR_DE_TODOS } from "./escopo-saida.ts";

const raiz = new URL("../../../", import.meta.url);
const ler = (p: string) => readFileSync(new URL(p, raiz), "utf8");

test("E391 (1): Sair e expiração de 24h são locais; sair de todos e excluir a conta são globais", () => {
  assert.equal(ESCOPO_SAIR, "local");
  assert.equal(ESCOPO_EXPIRACAO_24H, "local");
  assert.equal(ESCOPO_SAIR_DE_TODOS, "global");
  assert.equal(ESCOPO_EXCLUIR_CONTA, "global");
});

test("E391 (1): cada saída da conta passa o escopo (nenhum signOut() sem argumento no cliente)", () => {
  assert.match(ler("src/components/account/use-sair.ts"), /auth\.signOut\(\{ scope: ESCOPO_SAIR \}\)/);
  assert.match(ler("src/components/layout/dashboard-shell.tsx"), /auth\.signOut\(\{ scope: ESCOPO_SAIR \}\)/);
  assert.match(ler("src/components/auth-provider.tsx"), /auth\.signOut\(\{ scope: ESCOPO_EXPIRACAO_24H \}\)/);
  const secoes = ler("src/components/account/conta-secoes.tsx");
  assert.match(secoes, /auth\.signOut\(\{ scope: ESCOPO_SAIR_DE_TODOS \}\)/);
  assert.match(secoes, /auth\.signOut\(\{ scope: ESCOPO_EXCLUIR_CONTA \}\)/);

  // Varredura: em src/components e src/app, todo `auth.signOut(` traz um escopo explícito. O padrão do Supabase
  // sem argumento é GLOBAL — um "Sair" novo sem escopo voltaria a derrubar os outros aparelhos.
  const semEscopo: string[] = [];
  const varrer = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) varrer(caminho);
      else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) {
        if (/auth\s*\.signOut\(\s*\)/.test(readFileSync(caminho, "utf8"))) semEscopo.push(caminho);
      }
    }
  };
  varrer(fileURLToPath(new URL("src/components/", raiz)));
  varrer(fileURLToPath(new URL("src/app/", raiz)));
  assert.deepEqual(semEscopo, []);
});

test("E391 (1): 'Sair de todos os aparelhos' fica em Conta → Segurança, separado e com confirmação na página", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/conta/seguranca/page.tsx"), /<SairDeTodosAparelhos \/>/);
  const secoes = ler("src/components/account/conta-secoes.tsx");
  assert.match(secoes, /export function SairDeTodosAparelhos\(\)[\s\S]*?<ConfirmarNaPagina[\s\S]*?testid="sair-de-todos"/);
  // Os tokens de push de todos os aparelhos saem ANTES do signOut global (depois dele já não há sessão para apagar).
  const corpo = secoes.slice(secoes.indexOf("export function SairDeTodosAparelhos"));
  assert.ok(corpo.indexOf("removerTodosPushTokens()") < corpo.indexOf("ESCOPO_SAIR_DE_TODOS })"));
  assert.match(ler("src/lib/data/push-actions.ts"), /export async function removerTodosPushTokens[\s\S]*?\.delete\(\)\.eq\("user_id", user\.id\)/);
  // O "Sair" do menu continua um só e diz a verdade: só este aparelho.
  assert.match(ler("src/components/account/conta-menu.tsx"), /label: "Sair", descricao: "Encerrar a sessão neste aparelho\."/);
  assert.match(TEXTO_SAIR_DE_TODOS.explicacao, /inclusive neste/);
});
