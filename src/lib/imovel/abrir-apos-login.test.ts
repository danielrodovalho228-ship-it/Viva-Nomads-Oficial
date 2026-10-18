import { test } from "node:test";
import assert from "node:assert/strict";
import { alvoAbrir, urlLoginParaAbrir } from "./abrir-apos-login.ts";
import { safeInternalPath } from "../safe-redirect.ts";

test("visita sem login: vai ao /auth e volta ao mesmo imóvel com a janela aberta", () => {
  const url = urlLoginParaAbrir("abc-123", "video");
  assert.equal(url, "/auth?redirect=%2Fimoveis%2Fabc-123%3Fabrir%3Dvideo");
  const destino = safeInternalPath(new URLSearchParams(url.split("?")[1]).get("redirect"));
  assert.equal(destino, "/imoveis/abc-123?abrir=video");
  assert.equal(alvoAbrir("?abrir=visita"), "visita");
  assert.equal(alvoAbrir("?abrir=video"), "video");
  assert.equal(alvoAbrir("?abrir=outra"), null);
  assert.equal(alvoAbrir(""), null);
});
