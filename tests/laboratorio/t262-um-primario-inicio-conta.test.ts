import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// L-66 / t262: um único botão cheio (primário) por tela. O Início do dono já tem o bloco principal; o
// "Publicar pedido de moradia" do "Peça na Viva" e o "Salvar" de "Meus dados" (Conta, ao lado do
// "Salvar alterações" do perfil) ficam em contorno.
const tag = (arquivo: string, testid: string): string => {
  const fonte = readFileSync(arquivo, "utf8");
  const i = fonte.indexOf(`data-testid="${testid}"`);
  assert.ok(i > 0, `${testid} existe em ${arquivo}`);
  const ini = Math.max(fonte.lastIndexOf("<Button", i), fonte.lastIndexOf("<ButtonLink", i));
  return fonte.slice(ini, i);
};

test("Início do dono: 'Publicar pedido de moradia' não é primário", () => {
  assert.match(tag("src/components/painel/inicio-dono.tsx", "inicio-dono-pedido"), /variant="outline"/);
});

test("Início do dono: o botão do bloco principal continua primário", () => {
  assert.doesNotMatch(tag("src/components/painel/inicio-dono.tsx", "inicio-dono-botao"), /variant=/);
});

test("Conta: 'Salvar' de Meus dados não é primário (o primário é o 'Salvar alterações' do perfil)", () => {
  assert.match(tag("src/components/account/conta-secoes.tsx", "dados-salvar"), /variant="outline"/);
});
