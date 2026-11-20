// E726 (Phoenix/RELATORIO-002, A5): o selo "Anúncio de exemplo" mudava de posição entre os cartões da busca (à direita, ou
// quebrado abaixo à esquerda, conforme a largura e o nome do bairro). Agora tem uma posição só: abaixo do bairro, à esquerda.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync("src/components/property-card.tsx", "utf8");

test("E726: o selo do exemplo fica FORA da linha do bairro (flex-wrap), numa posição única", () => {
  const iniLinha = s.indexOf('data-testid="cartao-local-linha"');
  const iniSelo = s.indexOf('data-testid="cartao-selo-exemplo"');
  const fimLinha = s.indexOf("</div>", s.indexOf('data-testid="cartao-local"', iniLinha) + 1);
  assert.ok(iniSelo > fimLinha, "o selo vem depois de fechar a linha do bairro");
  assert.equal((s.match(/>\s*Anúncio de exemplo\s*</g) ?? []).length, 1, "o texto do selo existe em um lugar só");
  assert.doesNotMatch(s, /shrink-0 text-xs leading-6 text-apoio">Anúncio de exemplo/);
});
