/*
  E73 — o /admin no celular (casca): navegação à vista com "Voltar ao site", alerta do backup com peso de alerta e a
  linha de decisão tocável inteira. No computador a estrutura não muda. Roda: node --test src/lib/admin/admin-celular-e73.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("(a) E176 (D3): no celular, '‹ Voltar ao site' à vista e UM caminho de menu — o hambúrguer do topo (sem 'Menu da equipe')", () => {
  const shell = ler("components/layout/dashboard-shell.tsx");
  const bloco = shell.slice(shell.indexOf('pathname.startsWith("/admin") && ('), shell.indexOf("Aviso fixo do modo demonstração"));
  assert.match(bloco, /data-testid="admin-nav-celular"/);
  assert.match(bloco, /lg:hidden/);
  assert.match(bloco, /href="\/" [^>]*data-testid="admin-voltar-site"[\s\S]*?Voltar ao site/);
  assert.doesNotMatch(shell, /Menu da equipe/);
  assert.match(shell, /aria-label="Abrir menu"\s+data-testid=\{naAreaAdmin \? "admin-abrir-menu" : undefined\}/);
});

test("(b) E176 (D3): o alerta do backup aparece UMA vez, dentro de 'Precisa da sua atenção' (sem a faixa vermelha duplicada)", () => {
  const pagina = ler("app/(dashboard)/admin/page.tsx");
  assert.doesNotMatch(pagina, /AlertaBackupCelular/);
  assert.doesNotMatch(ler("components/admin/cartao-backup.tsx"), /AlertaBackupCelular/);
  // O backup nunca fica de fora do corte das 5 primeiras linhas da atenção.
  assert.match(pagina, /comBackup\(primeirosSemDuplicata\(/);
  // A linha de saúde não repete o alerta com link próprio.
  assert.doesNotMatch(pagina, /alertas"\} → Sistema/);
  assert.match(ler("app/(dashboard)/admin/sistema/page.tsx"), /<div id="backup"/);
});

test("(c) a linha de decisão inteira é tocável e leva ao mesmo destino do botão", () => {
  const n = ler("components/admin/numeros.tsx");
  assert.match(n, /<li key=\{l\.chave\} className="relative /);
  assert.match(n, /<Link href=\{l\.href\} className="[^"]*after:absolute after:inset-0/);
  assert.match(n, /<ButtonLink href=\{l\.href\}[^>]*className="relative z-10"/);
});
