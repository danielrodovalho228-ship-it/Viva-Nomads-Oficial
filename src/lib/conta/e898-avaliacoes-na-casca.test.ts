/*
  E898 — Avaliações abria FORA da casca da Conta (sem o menu lateral, com cabeçalho próprio "‹ Avaliações", coluna
  estreita). Agora renderiza na CascaConta, com "Avaliações" ativo, como as seções irmãs. A varredura das irmãs achou
  o mesmo desvio em /dashboard/conta/perfil-publico (subtela do Perfil fora da casca): corrigido junto.
  Roda: node --test src/lib/conta/e898-avaliacoes-na-casca.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { SECOES_CONTA } from "./secoes.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const APP = "app/(dashboard)/dashboard";

test("E898: /dashboard/avaliacoes renderiza na CascaConta com 'Avaliações' ativo", () => {
  const pagina = ler(`${APP}/avaliacoes/page.tsx`);
  assert.match(pagina, /import \{ CascaConta \} from "@\/components\/account\/casca-conta"/);
  assert.match(pagina, /<CascaConta ativo="avaliacoes">\s*<PainelAvaliacoes /);
});

test("E898: o painel não traz mais cabeçalho, voltar e largura próprios (vêm da casca); conteúdo mantido", () => {
  const painel = ler("components/avaliacoes/painel.tsx");
  assert.doesNotMatch(painel, /<h1/);
  assert.doesNotMatch(painel, /VoltarCelular/);
  assert.doesNotMatch(painel, /max-w-3xl/);
  assert.doesNotMatch(painel, /mx-auto/);
  for (const t of ["painel-abas", "painel-para-avaliar", "painel-sigilo", "painel-feitas", "painel-sem-recebidas", "AvaliacoesRecebidasLista"]) {
    assert.ok(painel.includes(t), t);
  }
});

test("E898 (varredura): toda seção do menu da Conta tem a sua tela na CascaConta", () => {
  const SECAO = ler(`${APP}/conta/[secao]/page.tsx`);
  const telaDe: Record<string, string> = {
    "/dashboard/avaliacoes": ler(`${APP}/avaliacoes/page.tsx`),
    "/dashboard/notificacoes": ler(`${APP}/notificacoes/page.tsx`),
  };
  for (const s of SECOES_CONTA) {
    let src = telaDe[s.href];
    if (!src) {
      const id = s.href.replace("/dashboard/conta/", "");
      const propria = new URL(`../../${APP}/conta/${id}/page.tsx`, import.meta.url);
      src = existsSync(propria) ? readFileSync(propria, "utf8") : SECAO;
    }
    assert.match(src, new RegExp(`<CascaConta ativo="${s.id}"`), s.href);
  }
});

test("E898 (varredura): a subtela 'Seu perfil público' também fica na casca (Perfil ativo, '← Perfil')", () => {
  const SECAO = ler(`${APP}/conta/[secao]/page.tsx`);
  const bloco = SECAO.slice(SECAO.indexOf('bruta === "perfil-publico"'), SECAO.indexOf("const secao ="));
  assert.match(bloco, /<CascaConta ativo="perfil" subtela titulo="Seu perfil público"/);
  assert.doesNotMatch(bloco, /<VoltarLista|<PageTitle/);
});
