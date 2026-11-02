/*
  Varredura de erros e estados vazios (rodada 20) — leitura que falha nunca vira "não existe" que grava algo.
  Achado 96: emissão fiscal — o "já emitido?" engolia o erro e emitia um 2º recibo, com número novo, para o mesmo
             pagamento (não há índice único por pagamento_id); a fila de pendentes inflava pelo mesmo motivo.
  Achado 97: automação — contratoDoEvento engolia o erro dos "outros contratos": sem a próxima entrada, a janela da
             limpeza passava do check-in do próximo morador.
  Achado 98: "Remover foto" — getAvatarPath engolia o erro: o perfil era zerado e o arquivo ficava no Storage.
  Roda: node --test src/lib/data/achado96-98.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const fn = (s: string, de: string) => {
  const i = s.indexOf(de);
  const j = s.indexOf("\nexport ", i + 1);
  return s.slice(i, j < 0 ? undefined : j);
};

test("achado 96: sem conferir o 'já emitido', não emite; pendentes lançam; o botão do admin recusa", () => {
  const e = ler("src/lib/fiscal/emitir.ts");
  const emitir = e.slice(e.indexOf("async function emitir("), e.indexOf("const agora = new Date();", e.indexOf("async function emitir(")));
  assert.match(emitir, /if \(erroExistente\) return \{ ok: false, motivo: /);
  assert.ok(emitir.indexOf("if (erroExistente)") < emitir.indexOf("if (existente)"));
  assert.match(fn(e, "export async function emitirDoPagamento("), /if \(erroPg\) return \{ ok: false, motivo: "não foi possível ler o pagamento" \};/);
  const pend = fn(e, "export async function pagamentosConfirmadosSemDocumento");
  assert.match(pend, /if \(e1\) throw new Error\(/);
  assert.match(pend, /if \(e2\) throw new Error\(/);
  assert.match(ler("src/lib/data/documentos-falhas-actions.ts"), /pagamentosConfirmadosSemDocumento\(c\.admin\)\.catch\(\(\) => null\);\s*if \(!ids\) return \{ ok: false, error: /);
});

test("achado 97: contrato e próxima entrada lançam; o evento registra; recusar nova data pede 'Tente de novo'", () => {
  const s = ler("src/lib/automacao/servidor.ts");
  const c = fn(s, "export async function contratoDoEvento");
  assert.match(c, /if \(error\) throw new Error\(/);
  assert.match(c, /if \(erroOutros\) throw new Error\(/);
  assert.match(fn(s, "export async function aoEventoDaEstadia"), /try \{\s*const ctx = await contratoDoEvento/);
  assert.match(ler("src/lib/automacao/reagendamento-servidor.ts"), /contratoDoEvento\(admin, p\.contrato_id\)\.catch\(\(\) => null\);\s*if \(!ctx\) return \{ ok: false, erro: "Não foi possível ler a estadia agora\. Tente de novo\." \};/);
});

test("achado 98: remover foto não zera o perfil sem apagar o arquivo; leituras de exibição falham fechado", () => {
  assert.match(fn(ler("src/lib/data/avatar-url.ts"), "export async function getAvatarPath"), /if \(error\) throw new Error\(/);
  const a = ler("src/lib/data/avatar-actions.ts");
  const limpar = fn(a, "export async function clearMyAvatar");
  assert.match(limpar, /if \(path === "falhou"\) return \{ ok: false \};/);
  assert.match(limpar, /if \(error\) return \{ ok: false \};/);
  assert.ok(limpar.indexOf("if (error) return { ok: false };") < limpar.indexOf("avatar_url: null"));
  assert.equal(a.match(/getAvatarPath\([^)]*\)\.catch\(\(\) => null\)/g)?.length, 2);
  assert.match(ler("src/lib/data/estadia.ts"), /getAvatarPath\(c\.tenant_id\)\.catch\(\(\) => null\)/);
  assert.match(ler("src/components/account/perfil-tela.tsx"), /const r = await clearMyAvatar\(\);\s*if \(!r\.ok\) \{/);
});
