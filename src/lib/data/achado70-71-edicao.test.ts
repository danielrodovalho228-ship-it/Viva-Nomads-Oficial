/*
  Varredura de erros e estados vazios (rodada 11) — leitura que falha nunca abre um formulário vazio que, salvo, grava
  por cima do que existe.
  Achado 70: getMeuPerfilPublico engolia o erro → bio, cidade e idiomas vazios no Perfil; "Salvar" apagava o perfil.
             A tela ficava em branco quando getMeusDados lançava (rodada 10).
  Achado 71: getMeuPedido engolia o erro e a tela de edição abria o formulário em branco; "Salvar" regravava o pedido.
  Roda: node --test src/lib/data/achado70-71-edicao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("achado 70: getMeuPerfilPublico lança na falha; o Perfil avisa com Tentar de novo, sem formulário", () => {
  const s = ler("src/lib/data/perfil-actions.ts");
  const fn = s.slice(s.indexOf("export async function getMeuPerfilPublico"));
  assert.match(fn, /const \[\{ data, error \}, \{ count, error: erroImoveis \}, fone, doc\]/);
  assert.match(fn, /if \(error \|\| erroImoveis\) throw new Error\("Não foi possível ler o perfil público\."\);/);
  const tela = ler("src/components/account/perfil-tela.tsx");
  assert.doesNotMatch(tela, /\.catch\(\(\) => vivo && setP\(null\)\)/);
  assert.match(tela, /if \(vivo\) setLeituraFalhou\(true\);/);
  assert.match(tela, /if \(leituraFalhou\)\s*return \(/);
  assert.match(tela, /data-testid="perfil-leitura-falha"/);
  assert.match(tela, /data-testid="perfil-leitura-tentar"/);
  assert.ok(tela.indexOf("if (leituraFalhou)") < tela.indexOf('data-testid="perfil-salvar"'));
});

test("achado 71: getMeuPedido lança na falha; a edição do pedido avisa e não mostra o formulário", () => {
  const s = ler("src/lib/data/pedidos-actions.ts");
  const fn = s.slice(s.indexOf("export async function getMeuPedido"), s.indexOf("export async function editarPedido"));
  assert.match(fn, /const \{ data, error \} = await supabase\.from\("pedidos_moradia"\)/);
  assert.match(fn, /if \(error\) throw new Error\("Não foi possível ler o pedido\."\);/);
  const pg = ler("src/app/(public)/pedidos/novo/page.tsx");
  assert.match(pg, /setLeituraFalhou\(true\);/);
  assert.match(pg, /\}, \[editarId, tentativa\]\);/);
  assert.match(pg, /if \(editarId && leituraFalhou\) \{/);
  assert.match(pg, /data-testid="pedido-leitura-falha"/);
  assert.match(pg, /data-testid="pedido-leitura-tentar"/);
  assert.ok(pg.indexOf("if (editarId && leituraFalhou)") < pg.indexOf('data-testid="pedido-formulario"'));
});
