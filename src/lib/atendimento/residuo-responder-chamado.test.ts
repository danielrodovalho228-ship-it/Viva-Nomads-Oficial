/*
  Resíduo da varredura de funções — responderMeuChamado, pedirPessoa e marcarResolvido (baixo): chamadoDoDono lia o chamado sem
  conferir o erro e devolvia null. Na falha, a pessoa lia "Chamado não encontrado nesta conta." no próprio chamado (e
  a mensagem dela não era enviada). Agora a leitura LANÇA, e os dois botões respondem "tente de novo" — sem gravar
  mensagem nem pedir pessoa; "não encontrado" fica só para o chamado que não é dela.
  Roda: node --test src/lib/atendimento/residuo-responder-chamado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const trecho = (src: string, de: string) => src.slice(src.indexOf(de), src.indexOf("\n}\n", src.indexOf(de)));

test("chamadoDoDono lança na falha da leitura (não é 'não encontrado')", () => {
  const fn = trecho(ler("src/lib/atendimento/dono.ts"), "export async function chamadoDoDono");
  assert.match(fn, /const \{ data, error \} = await q\.maybeSingle\(\);/);
  assert.match(fn, /if \(error\) throw new Error\(/);
});

test("responderMeuChamado e pedirPessoa: falha → 'tente de novo', antes de gravar", () => {
  const a = ler("src/lib/data/atendimento-actions.ts");
  for (const [nome, vazio] of [
    ["export async function responderMeuChamado", '"Chamado não encontrado nesta conta."'],
    ["export async function pedirPessoa(", '"Chamado não encontrado nesta conta."'],
    ["export async function marcarResolvido", '"Este chamado não está aguardando você."'],
  ]) {
    const fn = trecho(a, nome);
    assert.match(fn, /\)\.catch\(\(\) => "falhou" as const\);/, nome);
    const g = fn.indexOf('if (c === "falhou") return { ok: false, error: MSG_CHAMADO_SEM_LEITURA };');
    assert.ok(g > 0 && g < fn.indexOf(vazio), nome);
  }
  // A página do chamado (meuChamado) não captura: a falha cai no error.tsx ("Tente de novo"), nunca "não encontrado".
  assert.doesNotMatch(trecho(a, "export async function meuChamado"), /chamadoDoDono[\s\S]*?\.catch\(/);
});

test("Central de Ajuda: a falha ao carregar o chamado avisa; nunca 'Chamado não encontrado'", () => {
  const t = ler("src/components/ajuda/central-ajuda.tsx");
  assert.doesNotMatch(t, /\.catch\(\(\) => setDados\(null\)\)/);
  assert.match(t, /\.catch\(\(\) => setFalhaLeitura\(true\)\)/);
  assert.match(t, /data-testid="chamado-sem-leitura"/);
});
