/*
  E984 (t397) — anúncio PUBLICADO não mostrava em Meus imóveis o aviso "Refaça a foto … pela câmera até <data>": o cartão
  do publicado esconde o bloco de prontidão inteiro (sem "% completo", E567), e a prova com prazo ia junto — vencida, o
  item deixa de contar e o nível cai sem a dona ter sido avisada ali. Correção: no publicado, só as pendências COM PRAZO
  aparecem (sem barra e sem percentual). Roda: node --test src/lib/anuncio/e984-prazo-no-publicado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pendenciasComPrazo } from "./prontidao.ts";

test("E984 — só as provas a refazer, ainda não feitas, contam como pendência com prazo", () => {
  const opcionais = [
    { key: "video", ok: false },
    { key: "refazer_foto_cozinha_microondas", ok: false },
    { key: "refazer_foto_sala_sofa", ok: true },
    { key: "selo", ok: false },
  ];
  assert.deepEqual(pendenciasComPrazo(opcionais).map((o) => o.key), ["refazer_foto_cozinha_microondas"]);
  assert.deepEqual(pendenciasComPrazo([]), []);
});

test("E984 — o cartão do publicado mostra o prazo (sem % completo); o do rascunho segue como antes", () => {
  const s = readFileSync("src/app/(dashboard)/dashboard/imoveis/imoveis-client.tsx", "utf8");
  assert.match(s, /\{!demoItem && comp && imovelPublicado\(p\) && pendenciasComPrazo\(comp\.opcionais\)\.length > 0 && \(/);
  assert.match(s, /data-testid="prazos-publicado"/);
  const bloco = s.slice(s.indexOf('data-testid="prazos-publicado"'), s.indexOf("!demoItem && comp && !imovelPublicado(p)"));
  assert.doesNotMatch(bloco, /% completo|comp\.pct/);
  assert.match(s, /\{!demoItem && comp && !imovelPublicado\(p\) && \(/);
});
