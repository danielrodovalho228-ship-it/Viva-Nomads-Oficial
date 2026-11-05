/*
  E605: o interruptor "Mostrar" de um lugar de "O que tem por perto" (ex.: UFU, ligado) desligava em silêncio — o lugar
  saía do anúncio sem o diálogo do padrão TOGGLE aprovado (C9/E56: desligar o que está valendo pede confirmação na
  própria tela; ligar é imediato). Agora desligar mostra "Tirar … do anúncio?" com "Tirar do anúncio" e "Cancelar".
  Roda: node --test src/lib/anuncio/e605-mostrar-confirma.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aoDesligar } from "../ui/bloco-opcional.ts";
import { textoConfirmarOcultarLugar } from "./perto-confirmar.ts";

test("E605: a regra do padrão — desligar o que aparece pede confirmação; o que já está fora alterna direto", () => {
  assert.equal(aoDesligar(true), "confirmar");
  assert.equal(aoDesligar(false), "fechar");
});

test("E605: o texto diz o lugar e o efeito", () => {
  assert.equal(
    textoConfirmarOcultarLugar("UFU — Campus Santa Mônica"),
    "Tirar “UFU — Campus Santa Mônica” do anúncio? Ele deixa de aparecer em “O que tem por perto”.",
  );
});

test("E605: o interruptor usa a regra e a confirmação fica na própria tela (nunca window.confirm)", () => {
  const b = readFileSync(new URL("../../components/anuncio/blocos-cadastro.tsx", import.meta.url), "utf8");
  const item = b.slice(b.indexOf("function ItemProximidade"), b.indexOf("/* ── Pronto para trabalhar de casa"));
  assert.match(item, /aoDesligar\(marcado\) === "confirmar"/);
  assert.match(item, /data-testid="proximidade-ocultar-confirmacao"/);
  assert.match(item, /data-testid="proximidade-ocultar-confirmar"/);
  assert.match(item, /data-testid="proximidade-ocultar-cancelar"/);
  assert.doesNotMatch(item, /window\.confirm|confirm\(/);
});
