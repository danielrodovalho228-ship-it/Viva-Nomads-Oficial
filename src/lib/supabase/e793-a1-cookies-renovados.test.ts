/*
  E793 A1 — o cookie renovado pelo proxy precisa chegar ao layout. Roda: node --test src/lib/supabase/e793-a1-cookies-renovados.test.ts
  O setAll do proxy gravava os cookies renovados só na RESPOSTA (para o navegador). O pedido que seguia para o layout e as
  páginas levava os cookies ANTIGOS — o token vencido e o refresh token que o proxy acabou de gastar. Padrão oficial do
  @supabase/ssr: gravar também no pedido e recriar a resposta com os cabeçalhos atualizados (mantendo x-vn-destino).
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NextRequest, NextResponse } from "next/server.js";
import { cookiesRenovados } from "./cookies-renovados.ts";

function cenario() {
  const pedido = new NextRequest("http://localhost/dashboard?x=1", {
    headers: { cookie: "sb-ref-auth-token=ANTIGO; outro=1" },
  });
  const montar = () => {
    const h = new Headers(pedido.headers);
    h.set("x-vn-destino", "/dashboard?x=1");
    return NextResponse.next({ request: { headers: h } });
  };
  return { pedido, ponto: cookiesRenovados(pedido, montar) };
}
/** O cabeçalho "cookie" que o Next encaminha ao layout (x-middleware-request-cookie). */
const encaminhado = (r: Response) => r.headers.get("x-middleware-request-cookie") ?? "";

test("depois de uma renovação, o pedido encaminhado ao layout leva o cookie NOVO (não o antigo)", () => {
  const { ponto } = cenario();
  ponto.setAll([{ name: "sb-ref-auth-token", value: "NOVO", options: { path: "/" } }]);
  const r = ponto.resposta();
  assert.match(encaminhado(r), /sb-ref-auth-token=NOVO/);
  assert.doesNotMatch(encaminhado(r), /ANTIGO/);
  assert.match(encaminhado(r), /outro=1/, "os outros cookies seguem");
});

test("a resposta recriada mantém o x-vn-destino e devolve o cookie novo ao navegador", () => {
  const { ponto } = cenario();
  ponto.setAll([{ name: "sb-ref-auth-token", value: "NOVO", options: { path: "/" } }]);
  const r = ponto.resposta();
  assert.equal(r.headers.get("x-middleware-request-x-vn-destino"), "/dashboard?x=1");
  assert.equal(r.cookies.get("sb-ref-auth-token")?.value, "NOVO");
});

test("duas chamadas de setAll: a 2ª resposta não perde o cookie da 1ª (o comCookies do E428 copia todos)", () => {
  const { ponto } = cenario();
  ponto.setAll([{ name: "a", value: "1" }]);
  ponto.setAll([{ name: "b", value: "2" }]);
  const r = ponto.resposta();
  assert.equal(r.cookies.get("a")?.value, "1");
  assert.equal(r.cookies.get("b")?.value, "2");
  assert.match(encaminhado(r), /a=1/);
  assert.match(encaminhado(r), /b=2/);
});

test("o proxy usa o encaminhamento (setAll do createServerClient) e o comCookies lê a resposta atual", () => {
  const proxy = readFileSync("src/proxy.ts", "utf8");
  assert.match(proxy, /cookiesRenovados\(request,/);
  assert.match(proxy, /setAll: \(lista\) => ponto\.setAll\(lista\)/);
  assert.match(proxy, /ponto\.resposta\(\)\.cookies\.getAll\(\)\.forEach\(\(c\) => r\.cookies\.set\(c\)\)/);
});
