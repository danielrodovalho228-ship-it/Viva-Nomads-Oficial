import { test } from "node:test";
import assert from "node:assert/strict";
import { escaparHtml } from "./escapar-html.ts";

test("escaparHtml neutraliza tags e aspas", () => {
  assert.equal(escaparHtml(`<a href="x">O'k & cia</a>`), "&lt;a href=&quot;x&quot;&gt;O&#39;k &amp; cia&lt;/a&gt;");
});

test("escaparHtml mantém texto comum e acentos", () => {
  assert.equal(escaparHtml("Documento ilegível — reenvie"), "Documento ilegível — reenvie");
});
