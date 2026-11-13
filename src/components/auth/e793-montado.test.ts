/*
  E793 A4 — o 1º quadro (servidor e hidratação) nunca usa o estado do navegador. Roda: node --test src/components/auth/e793-montado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useMontado } from "./montado.ts";

function Sonda() {
  return createElement("span", null, useMontado() ? "montado" : "primeiro-quadro");
}

test("no render do servidor, useMontado é falso (é o mesmo valor que a hidratação usa)", () => {
  assert.match(renderToString(createElement(Sonda)), /primeiro-quadro/);
});

test("os dois hooks do quadro passam pelo useMontado e pelas regras puras do A4", () => {
  const h = readFileSync("src/components/auth/sessao-servidor-contexto.tsx", "utf8");
  assert.match(h, /export function useUsuarioAtual[\s\S]*?useMontado\(\)[\s\S]*?escolherUsuario\(/);
  assert.match(h, /export function useModoAtual[\s\S]*?useMontado\(\)[\s\S]*?escolherModo\(/);
});
