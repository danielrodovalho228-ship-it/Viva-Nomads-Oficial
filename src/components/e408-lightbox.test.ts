import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("E408 — o lightbox fecha só no próprio fundo (target === currentTarget) e é um diálogo", () => {
  const g = readFileSync(new URL("./property-gallery.tsx", import.meta.url), "utf8");
  assert.match(g, /function fecharNoFundo\(e: React\.MouseEvent<HTMLElement>\) \{\s+if \(e\.target === e\.currentTarget\) onClose\(\);/);
  assert.match(g, /data-testid="galeria-lightbox"\s+role="dialog"\s+aria-modal="true"/);
  assert.match(g, /onClick=\{fecharNoFundo\} data-testid="galeria-lightbox-fundo"/);
});
