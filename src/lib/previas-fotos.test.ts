/* Roda: node --test src/lib/previas-fotos.test.ts — E170: toda moldura de foto da Conta e das Ferramentas tem prévia. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PREVIAS_FOTOS } from "./previas-fotos.ts";
import { FOTOS_FERRAMENTAS } from "../components/dashboard/capas.ts";

test("cada foto dos grupos das Ferramentas tem a prévia borrada (nunca a caixa cinza lisa)", () => {
  for (const f of Object.values(FOTOS_FERRAMENTAS)) assert.match(PREVIAS_FOTOS[f.src] ?? "", /^data:image\/webp;base64,/, f.src);
});

test("cada foto de CartaoComFoto (Pagamentos e Ajuda) tem a prévia", () => {
  const media = readFileSync("src/lib/media.ts", "utf8");
  const bloco = media.slice(media.indexOf("pagamentos: {"), media.indexOf("ajudaContato"));
  const fotos = [...bloco.matchAll(/\$\{([HI])\}\/([\w./-]+)|"(\/images\/[\w./-]+)"/g)].map((m) =>
    m[3] ?? `${m[1] === "H" ? "/images/home" : "/images/imoveis"}/${m[2]}`,
  );
  fotos.push(media.match(/ajudaContato: "([^"]+)"/)![1]);
  assert.equal(fotos.length, 4);
  for (const f of fotos) assert.ok(PREVIAS_FOTOS[f], f);
});

test("a Privacidade não deixa o cartão em branco enquanto lê as chaves", () => {
  const tela = readFileSync("src/components/account/tela-privacidade.tsx", "utf8");
  assert.doesNotMatch(tela, /block h-56/);
  assert.match(tela, /-carregando`/);
});
