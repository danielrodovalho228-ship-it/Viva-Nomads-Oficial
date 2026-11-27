/*
  E476 (i), reprova da rodada 8: "a 'foto' exibida é uma silhueta genérica, não a foto enviada — o moderador julga uma
  foto que não vê". O servidor assina o arquivo canônico enviado (`<uid>/avatar.webp`) — isso já estava certo e segue
  guardado. O que faltava para o moderador VER: a foto saía num círculo de 96 px (cortada, pequena), sem abrir em
  tamanho real e, se a imagem não carregasse, a tela ficava com o ícone de imagem quebrada sem dizer nada.
  Agora: prévia quadrada inteira (sem cortar), "Abrir em tamanho real" (nova aba) e aviso visível se não carregar.
  Roda: node --test src/lib/admin/e476-foto-perfil-previa.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const cliente = ler("app/(dashboard)/admin/fotos-perfil/fila-fotos-cliente.tsx");

test("a prévia mostra a foto inteira e grande, não um círculo de 96 px cortado", () => {
  assert.match(cliente, /data-testid="foto-previa"/);
  assert.doesNotMatch(cliente, /h-24 w-24 shrink-0 rounded-full object-cover/);
  assert.match(cliente, /object-contain/);
  assert.match(cliente, /aspect-square/);
});

test("o moderador abre o arquivo em tamanho real, em nova aba", () => {
  assert.match(cliente, /data-testid="foto-abrir"/);
  assert.match(cliente, /target="_blank"/);
  assert.match(cliente, /rel="noopener noreferrer"/);
  assert.match(cliente, /Abrir em tamanho real/);
});

test("se a imagem não carregar, a tela diz isso (nada de imagem quebrada em silêncio)", () => {
  assert.match(cliente, /onError=\{\(\) => setFalhou\(true\)\}/);
  assert.match(cliente, /data-testid="foto-previa-erro"/);
  assert.match(cliente, /Não foi possível carregar a imagem/);
});

test("o servidor segue assinando só o arquivo canônico enviado pela própria conta", () => {
  const fila = ler("lib/data/fotos-perfil-actions.ts");
  assert.match(fila, /url: await signAvatarPath\(l\.caminho, l\.user_id\)/);
  const url = ler("lib/data/avatar-url.ts");
  assert.match(url, /if \(!ehAvatarDoUsuario\(path, ownerId\)\) return null;/);
});
