import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shell = readFileSync("src/components/layout/dashboard-shell.tsx", "utf8");

// F13 (ordem 7ac560e7): o drawer não pode se desmontar no clique, antes do Link navegar.
// Ele fecha quando a rota muda; no clique só fecha se o destino é a própria página.
test("aoNavegar não fecha o drawer incondicionalmente", () => {
  const corpo = shell.slice(shell.indexOf("async function aoNavegar"));
  const inicio = corpo.slice(0, corpo.indexOf("const de = "));
  assert.doesNotMatch(inicio, /setOpen\(false\)\s*;\s*\n\s*const rota/);
  assert.match(inicio, /rota === pathname/);
});

test("drawer fecha quando o pathname muda", () => {
  assert.match(shell, /pathnameDrawer/);
  assert.match(shell, /setPathnameDrawer\(pathname\)/);
});
