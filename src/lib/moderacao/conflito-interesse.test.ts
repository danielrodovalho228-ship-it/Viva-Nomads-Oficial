import assert from "node:assert/strict";
import { test } from "node:test";

import { erroConflitoInteresse, MSG_DONO_DO_ANUNCIO } from "./conflito-interesse.ts";

test("admin que é dono do anúncio recebe a mensagem de conflito", () => {
  assert.equal(erroConflitoInteresse("u1", "u1"), MSG_DONO_DO_ANUNCIO);
  assert.match(MSG_DONO_DO_ANUNCIO, /dono deste anúncio/);
});

test("outro revisor ou dono ausente: sem erro de conflito (caso negativo)", () => {
  assert.equal(erroConflitoInteresse("u1", "u2"), null);
  assert.equal(erroConflitoInteresse(null, "u2"), null);
});
