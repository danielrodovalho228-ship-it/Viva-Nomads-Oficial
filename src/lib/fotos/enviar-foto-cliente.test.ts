/*
  E47-A-CORRECAO — envio de foto que nunca derruba a tela.
  Roda: node --test src/lib/fotos/enviar-foto-cliente.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG_FALHA_ENVIO_FOTO, enviarFotoDoAnuncio } from "./enviar-foto-cliente.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const foto = (bytes = 1000, nome = "foto.jpg", tipo = "image/jpeg") => new File([new Uint8Array(bytes)], nome, { type: tipo });
const resp = (status: number, corpo: unknown, headers: Record<string, string> = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
  json: async () => {
    if (corpo === "texto") throw new SyntaxError("Unexpected token");
    return corpo;
  },
});

test("rede caindo no meio do envio: não lança, vira a mensagem de tentar de novo", async () => {
  const r = await enviarFotoDoAnuncio(foto(), async () => {
    throw new TypeError("Failed to fetch");
  });
  assert.deepEqual(r, { ok: false, erro: MSG_FALHA_ENVIO_FOTO, motivo: "rede" });
  assert.equal(MSG_FALHA_ENVIO_FOTO, "Não foi possível enviar a foto. Confira a conexão e toque para tentar de novo.");
});

test("acima de 8 MB: a frase do servidor, sem enviar nada", async () => {
  let chamou = false;
  const r = await enviarFotoDoAnuncio(foto(8 * 1024 * 1024 + 1), async () => {
    chamou = true;
    return resp(200, { path: "x" });
  });
  assert.equal(chamou, false);
  assert.deepEqual(r, { ok: false, erro: "Cada foto deve ter no máximo 8 MB.", motivo: "arquivo" });
});

test("413: falha de envio, separando o limite da plataforma do da rota", async () => {
  const plataforma = await enviarFotoDoAnuncio(foto(), async () => resp(413, "texto", { "x-vercel-error": "FUNCTION_PAYLOAD_TOO_LARGE" }));
  assert.deepEqual(plataforma, { ok: false, erro: MSG_FALHA_ENVIO_FOTO, motivo: "413_plataforma", status: 413 });
  const rota = await enviarFotoDoAnuncio(foto(), async () => resp(413, { error: "Grande demais." }));
  assert.equal(rota.ok, false);
  assert.equal(!rota.ok && rota.motivo, "413_rota");
  assert.equal(!rota.ok && rota.erro, MSG_FALHA_ENVIO_FOTO);
});

test("5xx (com ou sem JSON) vira a mensagem de tentar de novo; recusa com motivo mostra a frase do servidor", async () => {
  const cinco = await enviarFotoDoAnuncio(foto(), async () => resp(502, "texto"));
  assert.deepEqual(cinco, { ok: false, erro: MSG_FALHA_ENVIO_FOTO, motivo: "servidor", status: 502 });
  const heic = await enviarFotoDoAnuncio(foto(), async () => resp(400, { error: "Envie a foto em JPG, PNG ou WebP." }));
  assert.deepEqual(heic, { ok: false, erro: "Envie a foto em JPG, PNG ou WebP.", motivo: "recusada", status: 400 });
  const ok = await enviarFotoDoAnuncio(foto(), async () => resp(200, { path: "u/f.webp", url: "https://x/f.webp" }));
  assert.deepEqual(ok, { ok: true, path: "u/f.webp", url: "https://x/f.webp" });
});

test("as telas usam o envio que nunca lança e não chamam mais o fetch direto", () => {
  for (const f of ["src/app/(dashboard)/dashboard/imoveis/[id]/nivel/form-nivel.tsx", "src/components/niveis/nivel-cadastro.tsx", "src/components/conforto/pendencias-conforto.tsx", "src/components/property/ajuda-publicar.tsx"]) {
    const s = ler(f);
    assert.match(s, /enviarFotoDoAnuncio\(/, f);
    assert.doesNotMatch(s, /fetch\("\/api\/upload\/foto"/, f);
  }
  // A ação do servidor dentro da transição também não escapa: try/catch com a mesma mensagem.
  const nivel = ler("src/app/(dashboard)/dashboard/imoveis/[id]/nivel/form-nivel.tsx");
  assert.match(nivel, /\} catch \{\s*setParaTentar\(arquivo \?\? null\);\s*setMsg\(\{ ok: false, t: MSG_FALHA_ENVIO_FOTO \}\);/);
  assert.match(nivel, /data-testid=\{`nivel-tentar-\$\{chave\}`\}/);
});
