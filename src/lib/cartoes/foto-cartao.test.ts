import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { fotoParaCartao, FOTO_CARTAO_MAX_BYTES } from "./foto-cartao.ts";

/** Foto de teste 1600×1200 em cada formato (gradiente simples, gerado na hora). */
async function foto(formato: "webp" | "jpeg" | "png" | "avif"): Promise<Uint8Array> {
  const base = sharp({ create: { width: 1600, height: 1200, channels: 3, background: { r: 28, g: 107, b: 58 } } });
  return new Uint8Array(await base[formato]().toBuffer());
}
function bytesDoDataUri(uri: string): Buffer {
  return Buffer.from(uri.slice(uri.indexOf(",") + 1), "base64");
}

test("WebP vira data:image/jpeg, com no máximo 1080 px de largura", async () => {
  const uri = await fotoParaCartao(await foto("webp"), "image/webp");
  assert.ok(uri?.startsWith("data:image/jpeg;base64,"));
  const meta = await sharp(bytesDoDataUri(uri!)).metadata();
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.width, 1080);
});

test("outros formatos que o satori não desenha (AVIF) também viram JPEG", async () => {
  const uri = await fotoParaCartao(await foto("avif"), "image/avif");
  assert.ok(uri?.startsWith("data:image/jpeg;base64,"));
});

test("JPEG e PNG passam como estão (mesmos bytes)", async () => {
  for (const [formato, tipo] of [["jpeg", "image/jpeg"], ["png", "image/png"]] as const) {
    const bytes = await foto(formato);
    const uri = await fotoParaCartao(bytes, `${tipo}; charset=binary`);
    assert.equal(uri, `data:${tipo};base64,${Buffer.from(bytes).toString("base64")}`);
  }
});

test("arquivo inválido, vazio, grande demais ou que não é imagem → null (o cartão sai com o fundo da marca)", async () => {
  const lixo = new TextEncoder().encode("isto não é uma foto");
  assert.equal(await fotoParaCartao(lixo, "image/webp"), null);
  assert.equal(await fotoParaCartao(lixo, "image/jpeg"), null);
  assert.equal(await fotoParaCartao(new Uint8Array(), "image/png"), null);
  assert.equal(await fotoParaCartao(new Uint8Array(FOTO_CARTAO_MAX_BYTES + 1), "image/webp"), null);
  assert.equal(await fotoParaCartao(await foto("jpeg"), "text/html"), null);
});

test("a rota usa fotoParaCartao, desenha com rede de segurança (sem foto, depois 503) e nunca entrega WebP ao satori", () => {
  const rota = readFileSync(new URL("../../app/cartoes/[curto]/imagem/route.tsx", import.meta.url), "utf8");
  assert.match(rota, /fotoParaCartao\(/);
  assert.match(rota, /async function respostaSegura\(/);
  assert.match(rota, /await r\.arrayBuffer\(\)/);
  assert.match(rota, /status: 503/);
  // Os dois desenhos (parceiro e anúncio/cartão-postal) passam pela rede de segurança.
  assert.equal(rota.match(/return respostaSegura\(foto, \(foto\) => new ImageResponse\(/g)?.length, 2);
  assert.doesNotMatch(rota, /image\\\/\(jpeg\|png\|webp\)/);
});

test("satori (ImageResponse do Next): WebP cru falha; a foto convertida desenha o cartão nos dois formatos", async () => {
  const { ImageResponse } = await import("next/og.js");
  const { createElement } = await import("react");
  const webp = await foto("webp");
  const desenhar = async (src: string, largura: number, altura: number) => {
    const r = new ImageResponse(createElement("div", { style: { display: "flex", width: "100%", height: "100%" } }, createElement("img", { src, width: largura, height: 600 })), { width: largura, height: altura });
    const png = Buffer.from(await r.arrayBuffer());
    return { tipo: r.headers.get("content-type"), w: png.readUInt32BE(16), h: png.readUInt32BE(20) };
  };
  await assert.rejects(desenhar(`data:image/webp;base64,${Buffer.from(webp).toString("base64")}`, 1080, 1350));
  const convertida = (await fotoParaCartao(webp, "image/webp"))!;
  assert.deepEqual(await desenhar(convertida, 1080, 1350), { tipo: "image/png", w: 1080, h: 1350 });
  assert.deepEqual(await desenhar(convertida, 1080, 1080), { tipo: "image/png", w: 1080, h: 1080 });
});
