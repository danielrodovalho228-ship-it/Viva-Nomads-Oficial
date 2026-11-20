/*
  E698 — primeira carga lenta lida como quebra: o mapa da /buscar aparecia cinza sem ruas (só os pinos), os cartões com
  retângulos cinza no lugar das fotos e o avatar do cabeçalho alternava foto/inicial por segundos. Não é o E503 (dados do
  Início); aqui é a PRIMEIRA PINTURA: prioridade de rede e placeholders HONESTOS (dizem que está carregando).
  Roda: node --test src/lib/e698-primeira-pintura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chaveFotoAvatar, lerFotoAvatar, gravarFotoAvatar } from "./foto-avatar-cache.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("E698 avatar: a última foto conhecida da conta aparece na 1ª pintura (cache por conta, nunca de outra)", () => {
  const mem = new Map<string, string>();
  const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  assert.equal(chaveFotoAvatar("u1"), "vn:foto-avatar:u1");
  assert.equal(lerFotoAvatar("u1", st), null);
  gravarFotoAvatar("u1", "https://x/f.jpg", st);
  assert.equal(lerFotoAvatar("u1", st), "https://x/f.jpg");
  assert.equal(lerFotoAvatar("u2", st), null, "outra conta não herda a foto");
  gravarFotoAvatar("u1", null, st);
  assert.equal(lerFotoAvatar("u1", st), null, "foto removida limpa o cache");
  assert.equal(lerFotoAvatar(undefined, st), null);
  const quebrado = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("bloqueado"); }, removeItem: () => { throw new Error("bloqueado"); } };
  assert.equal(lerFotoAvatar("u1", quebrado), null, "storage bloqueado nunca derruba");
  assert.doesNotThrow(() => gravarFotoAvatar("u1", "https://x", quebrado));
});

test("E698 avatar: as iniciais ficam por baixo e a foto só entra (fade) depois de carregada — nunca alterna", () => {
  const a = ler("src/components/ui/avatar.tsx");
  assert.match(a, /FotoDoAvatar/);
  const f = ler("src/components/ui/foto-do-avatar.tsx");
  assert.match(f, /"use client"/);
  assert.match(f, /onLoad=\{\(\) => setCarregada\(true\)\}/);
  assert.match(f, /onError=\{\(\) => setFalhou\(true\)\}/);
  assert.match(f, /opacity-0/);
  const shell = ler("src/components/layout/dashboard-shell.tsx");
  assert.match(shell, /lerFotoAvatar\(displayUser\?\.id\)/);
  assert.match(shell, /gravarFotoAvatar\(displayUser\.id, r\.url\)/);
});

test("E698 cartões: a foto mostra um brilho de 'carregando' (respeita movimento reduzido) até carregar", () => {
  const b = ler("src/components/brand-image.tsx");
  assert.match(b, /motion-safe:animate-pulse/);
  assert.match(b, /onLoad=\{\(\) => setCarregadaSrc\(src\)\}/);
});

test("E698 mapa: pré-conexão com o servidor de tiles, quadro com aviso 'Carregando o mapa' até o 1º tile e carregamento do módulo com quadro honesto", () => {
  const page = ler("src/app/(public)/buscar/page.tsx");
  assert.match(page, /preconnect\("https:\/\/basemaps\.cartocdn\.com"/);
  const mapa = ler("src/components/search-map.tsx");
  assert.match(mapa, /data-mapa-tiles=\{tilesProntos \? "pronto" : "carregando"\}/);
  assert.match(mapa, /data-testid="mapa-carregando"/);
  assert.match(mapa, /\.once\("load", \(\) => setTilesProntos\(true\)\)/);
  assert.match(mapa, /Carregando o mapa/);
  const cli = ler("src/app/(public)/buscar/search-client.tsx");
  assert.match(cli, /loading: \(\) => <MapaCarregandoModulo \/>/);
});
