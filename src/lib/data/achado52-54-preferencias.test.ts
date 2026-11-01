/*
  Varredura de erros (rodada 6) — preferências de aviso nunca são regravadas a partir de uma leitura que falhou.
  Achado 52: getCategoriasDesligadas → "[]" (tudo ligado): salvar religava o que a pessoa desligou ("Sugestões" incluso).
  Achado 53: getCanais → a tela de Notificações abria com e-mail, push e WhatsApp ligados; "Salvar" gravava isso.
  Achado 54: getNotifPrefs → interruptor de e-mail "ligado" padrão; um toque gravava por cima.
  Roda: node --test src/lib/data/achado52-54-preferencias.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("as três leituras lançam na falha (nunca valor padrão)", () => {
  assert.match(ler("src/lib/data/notif-categorias-actions.ts"), /const \{ data, error \} = await admin\.from\("profiles"\)\.select\("notif_categorias_desligadas"\)[\s\S]{0,80}if \(error\) throw/);
  assert.match(ler("src/lib/data/canais-actions.ts"), /const \{ data, error \} = await supabase\.from\("profiles"\)\.select\("notif_email, notif_whatsapp"\)[\s\S]{0,80}if \(error\) throw/);
  const p = ler("src/lib/data/pedidos-actions.ts");
  const fn = p.slice(p.indexOf("export async function getNotifPrefs"), p.indexOf("export async function setNotifPrefs"));
  assert.match(fn, /if \(error\) throw/);
});

test("Conta › Notificações: falhou → aviso com Tentar de novo, nunca os interruptores com o padrão", () => {
  const t = ler("src/components/account/tela-notificacoes.tsx");
  assert.doesNotMatch(t, /getCategoriasDesligadas\(\)\.catch/);
  assert.doesNotMatch(t, /c \?\? \{ email: true, push: true, whatsapp: true \}/);
  assert.match(t, /\.catch\(\(\) => vivo && setFalhou\(true\)\)/);
  assert.match(t, /data-testid="tela-notificacoes-falha"/);
});

test("painel da Conta e Meus pedidos: falhou → interruptor desabilitado/oculto e aviso, sem valor padrão", () => {
  const c = ler("src/components/account/conta-secoes.tsx");
  assert.doesNotMatch(c, /\.catch\(\(\) => vivo && setPrefs\(\{ email: true \}\)\)/);
  assert.doesNotMatch(c, /\.catch\(\(\) => vivo && setDesligadas\(\[\]\)\)/);
  assert.equal((c.match(/\.catch\(\(\) => vivo && setErro\(ERRO_LER_PREFERENCIAS\)\)/g) ?? []).length, 2);
  assert.match(ler("src/app/(dashboard)/dashboard/pedidos/page.tsx"), /getNotifPrefs\(\)\.catch\(\(\) => null\)/);
  assert.match(ler("src/app/(dashboard)/dashboard/pedidos/pedidos-client.tsx"), /data-testid="pedidos-notif-falha"/);
});
