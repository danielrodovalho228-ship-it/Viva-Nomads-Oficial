/*
  Varredura de erros (rodada 29): o bloco "Confiança" da Conta não afirma "falta" quando a leitura falhou.
  Achado 141: se a leitura do e-mail (getUser) falhava, o item dizia "Confirme pelo link que enviamos" a quem já tinha
    confirmado. Agora fica neutro: "Não foi possível verificar agora", sem pedir nada.
  Achado 142: se a leitura dos fatores de duas etapas falhava, o item dizia "Desativada" com o botão "Ativar" a quem já tinha
    a verificação ativa — um falso negativo de SEGURANÇA. Agora fica neutro, e o botão vira "Abrir" (a tela de segurança mostra
    o estado verdadeiro).
  O celular já seguia o padrão (sem resposta = "Em breve"); o LinkedIn só aparece com a chave e a leitura.
  Roda: node --test src/components/account/achado141-confianca-indisponivel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./conta-blocos.tsx", import.meta.url), "utf8");

test("existe o estado neutro 'indisponivel' e a mensagem", () => {
  assert.match(src, /type Situacao = "ok" \| "falta" \| "em_breve" \| "indisponivel";/);
  assert.match(src, /const TEXTO_INDISPONIVEL = "Não foi possível verificar agora";/);
});

test("Achado 141: e-mail sem leitura fica neutro; erro do getUser não vira 'não confirmado'", () => {
  assert.match(src, /sb\.auth\.getUser\(\)\.then\(\(\{ data, error \}\) => vivo && setEmailOk\(error \|\| !data\.user \? null : Boolean\(data\.user\.email_confirmed_at\)\)\)/);
  assert.match(src, /situacao: emailOk === null \? "indisponivel" : emailOk \? "ok" : "falta",/);
  assert.match(src, /detalhe: emailOk === null \? TEXTO_INDISPONIVEL : emailOk \? "Confirmado" : "Confirme pelo link que enviamos",/);
});

test("Achado 142: duas etapas sem leitura fica neutro, sem 'Desativada' nem 'Ativar'", () => {
  assert.match(src, /\.then\(\(\{ data, error \}\) => vivo && setDuasEtapas\(error \? null : Boolean\(data\?\.totp\?\.some\(\(f\) => f\.status === "verified"\)\)\)\)/);
  assert.match(src, /situacao: duasEtapas === null \? "indisponivel" : duasEtapas \? "ok" : "falta",/);
  assert.match(src, /detalhe: duasEtapas === null \? TEXTO_INDISPONIVEL : duasEtapas \? "Ativa" : "Desativada",/);
  assert.match(src, /acao: \{ texto: duasEtapas === null \? "Abrir" : duasEtapas \? "Gerenciar" : "Ativar", href: "\/dashboard\/conta\/seguranca" \},/);
});
