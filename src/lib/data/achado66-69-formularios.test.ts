/*
  Varredura de erros (rodada 10) — formulários do perfil nunca salvam por cima a partir de uma leitura que falhou.
  66 getMeusDados (Dados pessoais) · 67 getMeuEspacoTrabalho · 68 getMeuPorQueNaCidade · 69 getMinhaCategoria.
  Antes: a falha virava campos vazios e "Salvar" apagava o que estava gravado.
  Roda: node --test src/lib/data/achado66-69-formularios.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("os quatro leitores do perfil lançam na falha", () => {
  const s = ler("src/lib/data/perfil-actions.ts");
  for (const fn of ["getMeusDados", "getMeuEspacoTrabalho", "getMeuPorQueNaCidade", "getMinhaCategoria"]) {
    const corpo = s.slice(s.indexOf(`export async function ${fn}`));
    assert.match(corpo.slice(0, corpo.indexOf("\n}\n")), /const \{ data, error \} = await supabase[\s\S]*?if \(error\) throw new Error/, fn);
  }
});

test("espaço de trabalho, cidade e categoria: falhou → aviso no lugar do formulário (nada é salvo)", () => {
  for (const f of ["espaco-trabalho", "por-que-na-cidade", "categoria-profissional"]) {
    const t = ler(`src/components/account/${f}.tsx`);
    assert.match(t, /\.catch\(\(\) => (vivo|alive) && setFalhouLeitura\(true\)\)/, f);
    assert.doesNotMatch(t, /\.catch\(\(\) => \{\}\)\s*\.finally/, f);
    assert.match(t, new RegExp(`data-testid="${f}-falha"`), f);
    assert.ok(t.indexOf("if (falhouLeitura)") < t.lastIndexOf("  return ("), `${f}: o aviso vem antes do formulário`);
  }
});

test("dados pessoais: falhou → aviso e o salvar recusa", () => {
  const t = ler("src/components/account/conta-secoes.tsx");
  const bloco = t.slice(t.indexOf("export function DadosPessoais"), t.indexOf("export function", t.indexOf("export function DadosPessoais") + 10));
  assert.match(bloco, /setDadosFalharam\(true\);/);
  assert.match(bloco, /if \(dadosFalharam\) return setErro\(/);
});
