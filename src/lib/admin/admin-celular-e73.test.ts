/*
  E73 — o /admin no celular (casca): navegação à vista com "Voltar ao site", alerta do backup com peso de alerta e a
  linha de decisão tocável inteira. No computador a estrutura não muda. Roda: node --test src/lib/admin/admin-celular-e73.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("(a) nas telas /admin, no celular: 'Voltar ao site' (/) e 'Menu da equipe' à vista; some no computador", () => {
  const shell = ler("components/layout/dashboard-shell.tsx");
  const bloco = shell.slice(shell.indexOf('pathname.startsWith("/admin") && ('), shell.indexOf("Aviso fixo do modo demonstração"));
  assert.match(bloco, /data-testid="admin-nav-celular"/);
  assert.match(bloco, /lg:hidden/);
  assert.match(bloco, /href="\/" [^>]*data-testid="admin-voltar-site"[\s\S]*?Voltar ao site/);
  assert.match(bloco, /onClick=\{\(\) => setOpen\(true\)\}[\s\S]*?Menu da equipe/);
});

test("(b) backup vermelho: alerta no topo só no celular (role=alert, borda grossa, motivo e atalho); verde não aparece", () => {
  const c = ler("components/admin/cartao-backup.tsx");
  const alerta = c.slice(c.indexOf("export async function AlertaBackupCelular"));
  assert.match(alerta, /if \(!e\.vermelho\) return null;/);
  assert.match(alerta, /role="alert"[^>]*border-2 border-red-700[^>]*lg:hidden/);
  // ADMIN-3: o cartão do backup mora em /admin/sistema.
  assert.match(alerta, /href="\/admin\/sistema#backup"/);
  // O selo "Atenção" ganha borda grossa; o fundo continua branco (regra do admin).
  assert.match(c, /"border-2 border-red-700 bg-white text-red-800"/);
  const pagina = ler("app/(dashboard)/admin/page.tsx");
  // ADMIN-4: o alerta vem antes dos 4 números da inicial.
  assert.ok(pagina.indexOf("<AlertaBackupCelular />") < pagina.indexOf('data-testid="admin-numeros"'));
  assert.match(ler("app/(dashboard)/admin/sistema/page.tsx"), /<div id="backup"/);
});

test("(c) a linha de decisão inteira é tocável e leva ao mesmo destino do botão", () => {
  const n = ler("components/admin/numeros.tsx");
  assert.match(n, /<li key=\{l\.chave\} className="relative /);
  assert.match(n, /<Link href=\{l\.href\} className="[^"]*after:absolute after:inset-0/);
  assert.match(n, /<ButtonLink href=\{l\.href\}[^>]*className="relative z-10"/);
});
