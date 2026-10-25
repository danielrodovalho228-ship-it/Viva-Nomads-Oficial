import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROTA_EQUIPE } from "./conta-equipe.ts";

// O atalho "Equipe e aprovações" abre a aba Aprovações da Central (ADMIN-2: ?aba=aprovacoes; a âncora antiga segue).
test("a aba do atalho da Equipe existe na Central e mostra o estado vazio", () => {
  const ancora = new URL(ROTA_EQUIPE, "https://x").searchParams.get("aba");
  assert.equal(ancora, "aprovacoes");
  const central = readFileSync("src/app/(dashboard)/admin/agentes/central-client.tsx", "utf8");
  assert.match(central, new RegExp(`id="${ancora}"`));
  assert.match(central, /<CartoesAprovacao versao=\{0\} mostrarVazio/);
  const cartoes = readFileSync("src/components/admin/agentes/cartoes-aprovacao.tsx", "utf8");
  assert.match(cartoes, /Nada esperando o seu OK agora/);
});
