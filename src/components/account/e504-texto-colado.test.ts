/**
 * E504 (reprovado no lote 5 de 06/11): palavras COLADAS no texto extraído (leitura de tela, cópia) — "Responde45% das
 * conversas,em", "combinamcom", "nãotiverama" — e o enquadramento da prévia do Perfil alternando ("proprietário te vê" ×
 * "morador te vê") com o rótulo lateral fixo. Visualmente havia espaço (flex gap / {" "}), mas o texto saía em pedaços. `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("prévia do Perfil: 'Responde N% das conversas, …' é UM texto (template), não pedaços soltos num flex", () => {
  const s = ler("components/account/espelho-papel.tsx");
  assert.match(s, /<span>\{`Responde \$\{publico\.resposta\.taxa\}% das conversas, \$\{publico\.resposta\.tempo\}`\}<\/span>/);
  assert.doesNotMatch(s, /Responde \{publico\.resposta\.taxa\}/);
});

test("Avisos: a frase dos pedidos novos é um texto só, com os espaços dentro dele", () => {
  const s = ler("app/(dashboard)/dashboard/notificacoes/page.tsx");
  assert.match(s, /\{` \$\{pedidosNovos\.total === 1 \? "pedido combina" : "pedidos combinam"\} com um imóvel seu e ainda não \$\{pedidosNovos\.total === 1 \? "teve" : "tiveram"\} a sua oferta\.`\}/);
  assert.doesNotMatch(s, /combinam"\}\{" "\}/);
});

test("enquadramento da prévia: o rótulo lateral acompanha o papel e o espelho só aparece com a conta carregada", () => {
  const s = ler("components/account/perfil-tela.tsx");
  assert.match(s, /aria-label=\{papelEspelho === "proprietario" \? "Como o morador te vê" : "Como o proprietário te vê"\}/);
  assert.match(s, /const usuarioPronto = useAuthStore\(\(s\) => !!s\.user\);/);
  assert.match(s, /\{usuarioPronto \? \(\s*<EspelhoPorPapel/);
  assert.match(s, /data-testid="espelho-aguardando"/);
});
