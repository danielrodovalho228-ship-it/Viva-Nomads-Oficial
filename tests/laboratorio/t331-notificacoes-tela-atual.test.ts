import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TIPOS_AVISO } from "../../src/lib/conta/tela-notificacoes.ts";

// Rodada completa 5eb1fad9 (42a48ade, 10/11): t331 "1." esperava o bloco "notif-categorias" (painel antigo da Conta,
// interruptor que grava na hora e "Preferência salva."). /dashboard/notificacoes hoje desenha a TelaNotificacoes (E549):
// interruptores notif-tipo-<categoria>, botão notif-salvar e "Preferências salvas."; decisões e segurança não têm
// interruptor (sempre chegam).
test("t331: o teste 1 confere a tela que /dashboard/notificacoes desenha", () => {
  const spec = readFileSync("tests/e2e/specs/t331-preferencias-push-44b2.spec.ts", "utf8");
  const t1 = spec.slice(spec.indexOf('test("1.'), spec.indexOf('test("2.'));
  assert.ok(t1.length > 0);
  assert.doesNotMatch(t1, /notif-categorias|notif-categoria-/, "o bloco antigo não está nesta página");
  assert.match(t1, /notif-tipo-/);
  assert.match(t1, /getByTestId\("notif-salvar"\)\.click\(\)/);
  assert.match(t1, /"Preferências salvas\."/);
  const pagina = readFileSync("src/app/(dashboard)/dashboard/notificacoes/page.tsx", "utf8");
  assert.match(pagina, /<TelaNotificacoes /);
  const tela = readFileSync("src/components/account/tela-notificacoes.tsx", "utf8");
  assert.match(tela, /testId=\{`notif-tipo-\$\{t\.categoria\}`\}/);
  assert.match(tela, /"Preferências salvas\."/);
  const comInterruptor = TIPOS_AVISO.map((t) => t.categoria) as string[];
  for (const c of ["mensagens", "lembretes", "outros"]) assert.ok(comInterruptor.includes(c), c);
  for (const c of ["decisao", "seguranca"]) assert.ok(!comInterruptor.includes(c), `${c} sempre chega`);
});
