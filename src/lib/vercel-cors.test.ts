import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("vercel.json não libera CORS '*' nas APIs (#126)", () => {
  const cfg = readFileSync("vercel.json", "utf8");
  assert.doesNotMatch(cfg, /Access-Control-Allow-Origin/);
});
