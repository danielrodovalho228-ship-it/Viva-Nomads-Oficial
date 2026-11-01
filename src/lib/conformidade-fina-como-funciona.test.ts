import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("publico-como-funciona (mockup): títulos das trilhas e dos passos em verde", () => {
  const c = readFileSync(new URL("../app/(public)/como-funciona/page.tsx", import.meta.url), "utf8");
  assert.match(c, /<h2 className="font-title text-2xl font-semibold text-forest">\{title\}<\/h2>/);
  assert.match(c, /<h3 className="mt-4 font-title text-lg font-semibold text-forest">\{s\.title\}<\/h3>/);
});
