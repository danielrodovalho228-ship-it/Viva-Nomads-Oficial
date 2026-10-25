import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// t262: /dashboard/conta tinha 2 botões primários ("Salvar perfil" e "Salvar chave"). O da chave Pix é secundário.
const fonte = readFileSync("src/components/account/pagamentos-conta.tsx", "utf8");

test("'Salvar chave' não é botão primário (um primário por tela)", () => {
  const botao = fonte.match(/<Button[^>]*data-testid="conta-pix-salvar"[^>]*>/);
  assert.ok(botao, "botão conta-pix-salvar existe");
  assert.match(botao[0], /variant="secondary"/);
});

// E70: o bloco do dono usa a MESMA fonte de papéis do selo do topo e da barra (estadoDosPapeis, papel-actions), que
// espera a sessão e relê quando o papel muda — nada de cálculo próprio nem de leitura única na montagem.
test("E70: 'Como você recebe (proprietário)' segue a fonte de papéis da barra", () => {
  assert.match(fonte, /import \{ usePapeisDaConta \} from "@\/components\/papel\/use-troca-papel";/);
  assert.match(fonte, /const papeis = usePapeisDaConta\(\);\s*const dono = !!papeis\?\.includes\("proprietario"\);/);
  assert.doesNotMatch(fonte, /meusPapeis|papeisDaConta/);
  const hook = readFileSync("src/components/papel/use-troca-papel.ts", "utf8");
  assert.match(hook, /export function usePapeisDaConta\(\)[\s\S]{0,400}if \(!userId\) return;[\s\S]{0,200}estadoDosPapeis\(\)/);
  assert.match(hook, /export function useTrocaPapel\(\)[\s\S]{0,200}const papeis = usePapeisDaConta\(\);/);
  // Dono = conta com anúncio em qualquer status (ativo, pausado ou rascunho): a mesma regra da barra.
  const acao = readFileSync("src/lib/data/papel-actions.ts", "utf8");
  assert.match(acao, /papeisDaConta\(fatos\)\.some\(\(p\) => p\.papel === "proprietario" && p\.ativo\)/);
  assert.match(readFileSync("src/lib/onboarding/ativacao.ts", "utf8"), /const dono = f\.imoveis > 0;/);
  assert.match(readFileSync("src/lib/data/ativacao.ts", "utf8"), /from\("properties"\)\.select\("id", \{ count: "exact", head: true \}\)\.eq\("owner_id", user\.id\)\),/);
});
