/*
  E177 — cache das fotos do anúncio. A foto nova vai para o bucket público com 1 ano de cache na origem (nome único, sem
  sobrescrever). O minimumCacheTTL global NÃO sobe: o avatar (URL assinada, privada) passa pelo next/image no cartão do
  dono e no perfil público, e um TTL longo deixaria a cópia otimizada viva na borda depois de o link vencer.
  Roda: node --test src/lib/cache-fotos-e177.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

test("upload da foto do anúncio: 1 ano de cache, nome único e sem sobrescrever", () => {
  const rota = ler("src/app/api/upload/foto/route.ts");
  assert.match(rota, /const CACHE_FOTO_ANUNCIO = "31536000";/);
  assert.match(rota, /const path = `\$\{user\.id\}\/\$\{crypto\.randomUUID\(\)\}\.webp`;/);
  assert.match(rota, /upload\(path, webp, \{ contentType: "image\/webp", upsert: false, cacheControl: CACHE_FOTO_ANUNCIO \}\)/);
});

test("minimumCacheTTL fica no padrão enquanto URL assinada passar pelo next/image", () => {
  assert.doesNotMatch(ler("next.config.ts"), /minimumCacheTTL/);
  // As duas telas que mostram o avatar assinado com next/image (motivo de não subir o TTL global).
  assert.match(ler("src/components/property/owner-card.tsx"), /import Image from "next\/image"/);
  assert.match(ler("src/lib/data/properties.ts"), /signAvatarPath\(/);
  assert.match(ler("src/app/(public)/proprietario/[id]/page.tsx"), /<Image src=\{p\.fotoUrl\}/);
  assert.match(ler("src/lib/data/perfil-proprietario.ts"), /signAvatarPath\(l\.avatar_url, donoId\)/);
});

test("o que não muda: avatar sem cache e cópia do parceiro sobrescrevível", () => {
  assert.match(ler("src/components/account/foto-perfil.tsx"), /cacheControl: "0"/);
  assert.doesNotMatch(ler("src/lib/parceiros/pedido-actions.ts"), /cacheControl/);
});
