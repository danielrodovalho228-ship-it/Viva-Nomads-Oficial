/*
  Varredura de títulos (02/11, Pista A): nas etapas do cadastro, as seções logo abaixo do título da etapa (h1) eram h3 —
  a hierarquia pulava o h2 (leitor de tela e navegação por títulos). Fotos ("Vídeo do imóvel" e o guia Sala/Quarto/
  Dicas), Comodidades ("Segurança e imóvel"), Regras ("Convivência", "Limpeza durante a estadia") e Chácara/Sítio
  passam a h2, com as mesmas classes (o desenho não muda). A página pública /guia-fotos segue com h3 (sob o h2 dela).
  Roda: npm test
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("seções das etapas do cadastro em h2 (sem pular do h1 para o h3)", () => {
  const fotos = ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-fotos.tsx");
  assert.match(fotos, /<h2 className="mb-3 font-title text-base font-semibold text-ink">Vídeo do imóvel \(opcional\)<\/h2>/);
  assert.match(fotos, /<GuiaFotos comCta=\{false\} nivelTitulo=\{2\} \/>/);
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx"), /<h2 className="text-base font-semibold text-ink">Segurança e imóvel<\/h2>/);
  assert.match(ler("src/components/anuncio/regras-casa-campos.tsx"), /<h2 className="text-sm font-semibold text-ink">Convivência<\/h2>/);
  assert.match(ler("src/components/anuncio/limpeza-estadia-campos.tsx"), /<h2 className="text-sm font-semibold text-ink">Limpeza durante a estadia<\/h2>/);
  assert.match(ler("src/components/anuncio/campos-chacara.tsx"), /<h2 className="text-base font-semibold text-ink">Chácara\/Sítio<\/h2>/);
});

test("guia de fotos: h3 por padrão (página pública), h2 quando o cadastro pede", () => {
  const g = ler("src/components/fotos/guia-fotos.tsx");
  assert.match(g, /nivelTitulo = 3 \}: \{ comCta\?: boolean; nivelTitulo\?: 2 \| 3 \}/);
  assert.match(g, /const Titulo = nivelTitulo === 2 \? "h2" : "h3";/);
  assert.doesNotMatch(g, /<h3 id=\{`guia-/);
  assert.doesNotMatch(ler("src/app/(public)/guia-fotos/page.tsx"), /nivelTitulo/);
});
