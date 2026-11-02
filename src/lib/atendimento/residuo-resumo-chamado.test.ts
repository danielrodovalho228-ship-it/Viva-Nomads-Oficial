/*
  Resíduo da varredura de funções — resumoDoChamado (baixo-médio): o "Resumo e ações" do chamado (Admin →
  Atendimento) lia o chamado e as mensagens sem conferir o erro. Na falha das mensagens, o resumo era feito de uma
  conversa VAZIA e gravado como nota do chamado (resumo errado que fica); na falha da nota já salva, gerava outro
  (outra chamada à IA, nota em dobro, gasto do limite de 30/h). Agora: gerarResumo lança na falha da leitura (a
  abertura do chamado já pula o resumo nesse caso) e resumoDoChamado devolve "tente de novo" sem gerar nem gravar.
  Roda: node --test src/lib/atendimento/residuo-resumo-chamado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const trecho = (src: string, de: string) => src.slice(src.indexOf(de), src.indexOf("\n}\n", src.indexOf(de)));

test("gerarResumo: falha do chamado ou das mensagens lança (nunca resume uma conversa vazia)", () => {
  const fn = trecho(ler("src/lib/atendimento/viva-servidor.ts"), "export async function gerarResumo");
  assert.match(fn, /const \{ data, error: erroChamado \} = await admin\.from\("chamados"\)/);
  assert.match(fn, /if \(erroChamado\) throw new Error\(/);
  assert.match(fn, /const \{ data: msgs, error: erroMsgs \} = await admin\.from\("chamado_mensagens"\)/);
  assert.match(fn, /if \(erroMsgs\) throw new Error\(/);
  // A abertura do chamado (rodarViva) segue pulando o resumo quando ele lança.
  assert.match(ler("src/lib/atendimento/viva-servidor.ts"), /const g = await gerarResumo\(c\.id\)\.catch\(\(\) => null\);/);
});

test("resumoDoChamado: sem a nota salva ou sem o resumo, 'tente de novo' — nada gerado nem gravado", () => {
  const fn = trecho(ler("src/lib/data/atendimento-actions.ts"), "export async function resumoDoChamado");
  assert.match(fn, /const \{ data: notas, error: erroNota \} = await ctx\.admin/);
  const g1 = fn.indexOf("if (erroNota) return { ok: false, error: MSG_RESUMO_SEM_LEITURA };");
  assert.ok(g1 > 0 && g1 < fn.indexOf("situacaoLimite("), "confere a nota antes de gastar o limite");
  assert.match(fn, /const g = await gerarResumo\(chamadoId\)\.catch\(\(\) => "falhou" as const\);/);
  const g2 = fn.indexOf('if (g === "falhou") return { ok: false, error: MSG_RESUMO_SEM_LEITURA };');
  assert.ok(g2 > 0 && g2 < fn.indexOf('.from("chamado_mensagens").insert('), "não grava a nota");
});
