/*
  E1133 (ORDEM-DUET-586): a recusa de contacto no "Sobre você" da área do avaliador (/dashboard/parceiro/avaliacao) era
  SILENCIOSA para quem salvava. A action já recusava (`salvarMeuSobre` → `normalizarSobre` → `CONTATO_AVISO`, nada grava)
  e o FormAcao desenhava o aviso logo abaixo do botão "Salvar texto" — mas sem `campos`, nada rolava até ele: com o botão
  no fim do ecrã, o aviso nascia fora da vista. É o defeito do E1131 noutra superfície, com a mesma correcção: o aviso
  JUNTO do botão, com role="alert", e a página rola até ele.
  Roda: node --test src/lib/vistoria/e1133-aviso-do-sobre.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizarSobre } from "./vitrine-avaliadores.ts";
import { CONTATO_AVISO } from "../pedidos/pedidos.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const AREA = "src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx";
const FORM = "src/components/vistoria/form-acao.tsx";

test("E1133: o \"Sobre\" continua a recusar contacto com a frase da casa, e a action devolve essa recusa", () => {
  assert.deepEqual(normalizarSobre("Fale comigo no (34) 99876-5432"), { ok: false, erro: CONTATO_AVISO });
  assert.deepEqual(normalizarSobre("Escreva para rita.avalia@exemplo.com.br"), { ok: false, erro: CONTATO_AVISO });
  const acoes = ler("src/lib/vistoria/actions.ts");
  const fn = acoes.slice(acoes.indexOf("export async function salvarMeuSobre"), acoes.indexOf("export async function salvarMeuSobre") + 1200);
  assert.match(fn, /const v = normalizarSobre\(String\(form\.get\("sobre"\) \?\? ""\)\);\s+if \(!v\.ok\) return v;/);
});

test("E1133: o salvar do \"Sobre você\" pede ao FormAcao que role até o aviso (junto do botão Salvar texto)", () => {
  const s = ler(AREA);
  const painel = s.slice(s.indexOf('data-testid="meu-sobre"'), s.indexOf('data-testid="credenciamento-situacao"'));
  assert.match(painel, /<FormAcao acao=\{salvarMeuSobre\} className="mt-3 grid gap-2" testid="salvar-sobre" rolarAoAviso>/);
  // O aviso é o do FormAcao, desenhado depois dos campos e do botão: o botão vem antes do fim do formulário.
  assert.ok(painel.indexOf("Salvar texto") > painel.indexOf("<FormAcao"), "o botão está dentro do formulário");
});

test("E1133: o FormAcao com rolarAoAviso rola até o aviso (só quando pedido, sem mexer nas outras superfícies)", () => {
  const f = ler(FORM);
  assert.match(f, /rolarAoAviso\?: boolean;/);
  // O aviso continua a ser o mesmo <p> logo depois dos campos e do botão, com role="alert" na recusa e os testids de sempre.
  assert.match(f, /<p ref=\{avisoRef\} role=\{mostrar\.ok \? "status" : "alert"\}[^>]*data-testid=\{mostrar\.ok \? "acao-ok" : "acao-erro"\}>/);
  assert.ok(f.indexOf("{children}") < f.indexOf("ref={avisoRef}"), "o aviso vem depois dos campos e do botão");
  // A rolagem só acontece com a opção ligada e com um aviso à mostra.
  assert.match(f, /if \(!rolarAoAviso \|\| !mostrar\) return;\s+avisoRef\.current\?\.scrollIntoView\(\{ block: "center" \}\);/);
});
