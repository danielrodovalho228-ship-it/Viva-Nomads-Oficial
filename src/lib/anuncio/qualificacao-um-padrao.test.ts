/* Roda: node --test src/lib/anuncio/qualificacao-um-padrao.test.ts — E193 (um padrão só de controle na qualificação). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const TELA = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/qualificacao.tsx", "utf8");

test("sem interruptor nem chip: sim/não, opções e 'Não tem internet' usam o mesmo CartaoOpcao", () => {
  assert.doesNotMatch(TELA, /<Switch\b|from "@\/components\/ui\/switch"/);
  assert.match(TELA, /rotulo="Sim, tem"/);
  assert.match(TELA, /rotulo="Não tem"/);
  assert.match(TELA, /<CartaoOpcao on=\{sem\}[\s\S]{0,160}?rotulo="Não tem internet"/);
  // Os cartões de opção também passam pelo mesmo componente.
  assert.match(TELA, /\{q\.opcoes\.map\(\(o\) => \(\s*<CartaoOpcao/);
});

test("Passo 5 (E193, reteste de 30/10): toda escolha no cartão grande da Qualificação — sem pílula nem interruptor por item", () => {
  const ler = (p: string) => readFileSync(p, "utf8");
  const passo5 = ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx");
  const grupo = passo5.slice(passo5.indexOf("function GrupoComodidades"), passo5.indexOf("function AvisoBairro"));
  assert.match(grupo, /<CartaoEscolha\s+key=\{it\.key\}\s+papel="pressed"/);
  assert.match(grupo, /grid gap-2 sm:grid-cols-2/);
  // Os componentes do Passo 5: nenhuma pílula e nenhum interruptor por item (o interruptor do bloco opcional E56 fica).
  for (const arq of [
    "src/app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx",
    "src/components/conforto/checklist-conforto.tsx",
    "src/components/niveis/ruido-extras.tsx",
    "src/components/anuncio/estrutura-acessibilidade.tsx",
    "src/components/anuncio/medir-internet.tsx",
  ]) {
    const src = ler(arq);
    assert.doesNotMatch(src, /<Pilula\b/, arq);
    assert.doesNotMatch(src, /role="switch"/, arq);
  }
  const blocos = ler("src/components/anuncio/blocos-cadastro.tsx");
  const passo5Blocos = blocos.slice(0, blocos.indexOf("export function BlocoNegociacao"));
  assert.doesNotMatch(passo5Blocos, /<Pilula\b/);
  // Ruído: um cartão de marcar por pergunta (antes, pares Sim/Não).
  const ruido = ler("src/components/niveis/ruido-extras.tsx");
  assert.doesNotMatch(ruido, /rotulo="Sim"|rotulo="Não"/);
  assert.match(ruido, /papel="checkbox"[\s\S]{0,120}on=\{r\[p\.chave\] === true\}/);
});
