/* Roda: node --test src/lib/e405-e369-textos.test.ts — E405/E369 (02/11): textos colados ("Vivaem Uberlândia", "emUberlândia",
   "©2026Viva") — cada frase vira UM texto só; e o "Continue seu anúncio" não desenha o "nome" de uma foto de teste. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ehUrlDeImagem } from "./fotos-anuncio.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("frases montadas como um texto só", () => {
  assert.match(ler("../components/parceiros/servicos-painel.tsx"), /\{`Parceiros aprovados pela Viva\$\{cidade \? ` em \$\{cidade\}` : ""\}\. Você combina tudo pelas mensagens da Viva\.`\}/);
  const rodape = ler("../components/layout/footer.tsx");
  assert.match(rodape, /\{`Imóveis em \$\{c\.name\}`\}/);
  assert.match(rodape, /\{`© \$\{new Date\(\)\.getFullYear\(\)\} Viva Nomads · Estadias de 30 a 180 dias`\}/);
});

test("só URL de imagem vira foto do 'Continue seu anúncio'", () => {
  assert.equal(ehUrlDeImagem("https://x.supabase.co/storage/v1/object/public/property-photos/a/b.webp"), true);
  assert.equal(ehUrlDeImagem("http://127.0.0.1:54321/storage/v1/object/public/property-photos/a/b.png"), true);
  assert.equal(ehUrlDeImagem("/images/unicas/sala.webp"), true);
  assert.equal(ehUrlDeImagem("Foto QA Premium 1 - Sala"), false);
  assert.equal(ehUrlDeImagem("//cdn.exemplo.com/a.png"), false);
  assert.equal(ehUrlDeImagem(null), false);
  assert.match(ler("../components/painel/inicio-dono.tsx"), /const foto = bloco\.foto && ehUrlDeImagem\(bloco\.foto\) \? bloco\.foto : null;/);
  assert.match(ler("../app/(dashboard)/dashboard/page.tsx"), /\.map\(\(r\) => r\.url\)\.filter\(ehUrlDeImagem\)/);
});
