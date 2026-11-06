/**
 * Passo 7 — linha "Destaques" do mockup aprovado (cadastro-imovel-07): Mobiliado, Wi-Fi incluído, Aceita pets, no mesmo fato dos
 * passos 5 e 6 (sem dado novo). Decisão do Muse (06/11): em conflito entre regra genérica e mockup, vale o mockup. `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHAVE_WIFI_DESTAQUE, destaquesDoAnuncio } from "./destaques-logica.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("as três pílulas refletem mobiliado, internet e pets do cadastro", () => {
  const d = destaquesDoAnuncio({ furnished: true, petsOk: false, amenityKeys: { [CHAVE_WIFI_DESTAQUE]: true } });
  assert.deepEqual(d.map((x) => [x.rotulo, x.on]), [["Mobiliado", true], ["Wi-Fi incluído", true], ["Aceita pets", false]]);
  const vazio = destaquesDoAnuncio({ furnished: false, petsOk: true, amenityKeys: {} });
  assert.deepEqual(vazio.map((x) => x.on), [false, false, true]);
});

test("a chave do Wi-Fi é a mesma da comodidade do Passo 5", () => {
  assert.match(ler("../../../../../lib/amenities.ts"), new RegExp(`key: "${CHAVE_WIFI_DESTAQUE}"`));
});

test("o Passo 7 mostra a linha abaixo da descrição e alterna o MESMO estado dos outros passos", () => {
  const e = ler("./etapa-encontramos.tsx");
  assert.match(e, /<Erro msg=\{p\.erros\.descricao\} \/>\s*<\/Labeled>\s*\{\/\*[^*]*\*\/\}\s*<DestaquesPasso7/);
  assert.match(e, /if \(c === "mobiliado"\) p\.setFurnished\(\(v\) => !v\);/);
  assert.match(e, /else if \(c === "pets"\) p\.setPetsOk\(\(v\) => !v\);/);
  assert.match(e, /setAmenityKeys\(\(s\) => \(\{ \.\.\.s, \[CHAVE_WIFI_DESTAQUE\]: !s\[CHAVE_WIFI_DESTAQUE\] \}\)\)/);
});

test("pílula com alvo de 44 px, estado em aria-pressed e testid destaque-* (o laboratório t620 abre a exceção por esse prefixo)", () => {
  const c = ler("./destaques-passo7.tsx");
  assert.match(c, /min-h-11/);
  assert.match(c, /aria-pressed=\{d\.on\}/);
  assert.match(c, /data-testid=\{`destaque-\$\{d\.chave\}`\}/);
  assert.match(ler("../../../../../../tests/e2e/specs/t620-e193-um-controle-so.spec.ts"), /startsWith\("destaque-"\)/);
});
