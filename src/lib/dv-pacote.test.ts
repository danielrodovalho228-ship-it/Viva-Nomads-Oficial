/* Roda: node --test src/lib/dv-pacote.test.ts — guardas do pacote D-V (QA do Muse e prints do Daniel, 22/10). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ler = (p: string) => readFileSync(join("src", p), "utf8");

test("hero da home: prévia borrada no HTML, poster direto do /media com preload e fetchPriority alta, sem o otimizador", () => {
  const hero = ler("components/hero-video-bg.tsx");
  assert.match(hero, /HERO_PREVIA\s*=\s*\n?\s*"data:image\/webp;base64,/);
  assert.ok(hero.match(/HERO_PREVIA\s*=\s*\n?\s*"([^"]+)"/)![1].length < 400, "prévia de poucos bytes");
  assert.match(hero, /data-testid="hero-previa"/);
  assert.match(hero, /preload\(HERO_POSTER\.computador, \{ as: "image", imageSrcSet: HERO_SRCSET/);
  assert.match(hero, /fetchPriority="high"/);
  assert.match(hero, /loading="eager"/);
  assert.doesNotMatch(hero, /from "next\/image"/);
  assert.doesNotMatch(hero, /\bpriority\b(?!=)/, "priority do next/image (obsoleto no Next 16) não volta");
  assert.ok(statSync("public/media/hero-home-poster-768.webp").size < 25 * 1024, "poster do celular < 25 KB");
  assert.ok(statSync("public/media/hero-home-poster.webp").size < 60 * 1024, "poster do computador < 60 KB");
});

test("vídeo institucional: 720p leve no computador e 540p no celular, sem baixar antes do play", () => {
  const v = ler("components/institucional/video-institucional.tsx");
  assert.match(v, /mp4Celular: "\/media\/institucional-540\.mp4"/);
  assert.match(v, /<source src=\{VIDEO_INSTITUCIONAL\.mp4Celular\} type="video\/mp4" media="\(max-width: 767px\)" \/>/);
  assert.match(v, /preload="none"/);
  assert.ok(statSync("public/media/institucional.mp4").size < 3 * 1024 * 1024, "720p < 3 MB (era 5 MB em 1080p)");
  assert.ok(statSync("public/media/institucional-540.mp4").size < 2 * 1024 * 1024, "540p < 2 MB");
  // Índice (moov) antes dos dados (mdat): o play começa sem baixar o arquivo inteiro.
  for (const f of ["public/media/institucional.mp4", "public/media/institucional-540.mp4"]) {
    const cab = readFileSync(f).subarray(0, 64 * 1024).toString("latin1");
    const moov = cab.indexOf("moov");
    assert.ok(moov > 0 && (cab.indexOf("mdat") === -1 || moov < cab.indexOf("mdat")), `${f}: moov no começo (faststart)`);
  }
});

test("passos do proprietário: sem auto-rows-fr (no celular abria vão vazio nos passos 2 a 4)", () => {
  const vg = ler("app/(dashboard)/dashboard/visao-geral-client.tsx");
  const ol = vg.match(/<ol className="([^"]+)" data-testid="passos-proprietario">/);
  assert.ok(ol, "lista dos passos com data-testid");
  assert.doesNotMatch(ol![1], /auto-rows-fr/);
});

test("grades de 1 coluna no celular não esticam todas as linhas (auto-rows-fr só a partir de sm quando a grade é de 1 coluna)", () => {
  const pastas = ["app", "components"];
  // Grades de cartão de anúncio (property-card): todos os cartões têm o mesmo formato, então esticar não abre vão.
  const CARTOES_DE_ANUNCIO = new Set([
    "src/app/(dashboard)/dashboard/favoritos/page.tsx",
    "src/app/(public)/buscar/search-client.tsx",
    "src/app/(public)/cidades/[cidade]/page.tsx",
    "src/components/favoritos-lista.tsx",
  ]);
  const ruins: string[] = [];
  const andar = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) andar(p);
      else if (p.endsWith(".tsx") && !CARTOES_DE_ANUNCIO.has(p)) {
        for (const m of readFileSync(p, "utf8").matchAll(/className="([^"]*\bgrid\b[^"]*)"/g)) {
          const c = m[1].split(/\s+/);
          // Sem grid-cols-N base (= 1 coluna no celular) com auto-rows-fr sem prefixo: estica todas as linhas.
          if (c.includes("auto-rows-fr") && !c.some((x) => /^grid-cols-\d/.test(x))) ruins.push(`${p}: ${m[1]}`);
        }
      }
    }
  };
  for (const d of pastas) andar(join("src", d));
  assert.deepEqual(ruins, []);
});
