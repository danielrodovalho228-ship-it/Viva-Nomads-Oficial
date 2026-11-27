/*
  E13 (t442) / t441 — o "Problema com isto?" liga direto à página do atendimento.

  Antes, o link levava a /ajuda?contexto=…, e o hub fazia redirect() no servidor para /ajuda/fale-com-a-viva?… (E84).
  Os testes que afirmavam o endereço intermediário só passavam quando liam a URL antes do salto: o t442 caso 4 falhava
  1 vez em 3, e o t441 caso 5 tinha o mesmo risco. Agora o link já é o destino final, com o mesmo contexto. O hub segue
  redirecionando os links antigos (e-mails já enviados).
  Roda: node --test src/lib/ajuda/e13-problema-com-isto-direto.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HREF_FALE_COM_A_VIVA, destinoDoAtendimento } from "./rotas.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("E13 — o 'Problema com isto?' liga direto a /ajuda/fale-com-a-viva, sem passar pelo hub", () => {
  const s = ler("components/ajuda/problema-com-isto.tsx");
  assert.match(s, /href=\{`\$\{HREF_FALE_COM_A_VIVA\}\?contexto=\$\{tipo\}&id=\$\{encodeURIComponent\(id\)\}`\}/);
  assert.doesNotMatch(s, /href=\{`\/ajuda\?contexto=/, "o link não passa mais pelo hub /ajuda");
});

test("E13 — o destino direto é o mesmo a que o hub levaria (links antigos continuam iguais)", () => {
  const id = "a1b2-c3";
  const direto = `${HREF_FALE_COM_A_VIVA}?contexto=perfil&id=${encodeURIComponent(id)}`;
  assert.equal(destinoDoAtendimento({ contexto: "perfil", id }), direto);
});
