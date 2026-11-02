/*
  Movimento reduzido (02/11, Pista A): os blocos que "pulsam" (animate-pulse) ficavam piscando mesmo para quem pediu
  menos movimento no aparelho. Agora param (prefers-reduced-motion: reduce); os giradores seguem. O resto do site já
  respeitava (.reveal, folhas, selos), e o vídeo do imóvel só toca depois do clique em play.
  Roda: npm test
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

test("animate-pulse para com prefers-reduced-motion: reduce (fora de @layer)", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n\s*\.animate-pulse \{\n\s*animation: none;\n\s*\}\n\}/);
  const i = css.indexOf("@media (prefers-reduced-motion: reduce)");
  const antes = css.slice(0, i);
  // Fora de qualquer @layer aberto: tantas chaves abertas quanto fechadas até aqui.
  assert.equal((antes.match(/\{/g) ?? []).length, (antes.match(/\}/g) ?? []).length);
});

test("o vídeo do imóvel só toca depois do clique (o autoPlay está no tocador montado pelo play)", () => {
  const v = readFileSync(new URL("../../components/video-arquivo.tsx", import.meta.url), "utf8");
  assert.match(v, /const \[tocando, setTocando\] = useState\(false\);/);
});
