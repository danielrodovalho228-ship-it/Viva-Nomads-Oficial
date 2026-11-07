/* E691 — o número e o hash da assinatura do laudo aparecem ao avaliador e ao dono. Roda: node --test src/lib/vistoria/e691-assinatura-visivel.test.ts */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { textoAssinatura } from "./telas-laudo.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const HASH = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

test("texto da assinatura: número do laudo, data e hash (início e fim), sem inventar nada quando falta", () => {
  const t = textoAssinatura({ numero: "VIS-2026-000007", hash: HASH, em: "2026-11-07T15:30:00Z" });
  assert.ok(t);
  assert.match(t!.linha, /Assinado pelo avaliador em 07\/11\/2026/);
  assert.match(t!.linha, /VIS-2026-000007/);
  assert.equal(t!.hashCurto, "a1b2c3d4…c6d7e8f90".replace("c6d7e8f90", HASH.slice(-8)));
  assert.equal(t!.hash, HASH);
  assert.equal(textoAssinatura({ numero: "VIS-1", hash: null, em: null }), null);
  assert.equal(textoAssinatura({ numero: "VIS-1", hash: "curto", em: "2026-11-07T15:30:00Z" }), null);
});

test("o painel do avaliador e o laudo do dono leem e mostram a assinatura", () => {
  const dono = ler("src/components/vistoria/laudo-dono.tsx");
  assert.match(dono, /assinatura_hash/);
  assert.match(dono, /textoAssinatura\(/);
  assert.match(dono, /data-testid="laudo-assinatura"/);
  const av = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx");
  assert.match(av, /assinatura_hash/);
  assert.match(av, /textoAssinatura\(/);
  assert.match(av, /data-testid="laudo-assinatura"/);
});
