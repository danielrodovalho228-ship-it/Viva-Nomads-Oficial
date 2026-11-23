/*
  E1091 (ORDEM-DUET-446, classe B): na prova, "Escolher este avaliador" não dava resposta nenhuma — dois cliques sem
  confirmação nem mudança, e o efeito só aparecia depois de recarregar. Causa (reproduzida no laboratório, com o servidor
  lento): o formulário das ações da avaliação (FormAcao) não mostrava que estava a enviar e aceitava um segundo envio,
  que entrava na fila e atrasava ainda mais a tela. Agora, enquanto envia: diz "Enviando…", desliga os botões de envio
  e ignora um segundo envio. O erro continua a não limpar o que a pessoa digitou (E818).
  Roda: node --test src/lib/vistoria/e1091-form-acao-responde.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../components/vistoria/form-acao.tsx", import.meta.url), "utf8");

test("E1091: enquanto envia, o formulário diz 'Enviando…' e os botões de envio ficam desligados", () => {
  assert.match(src, /data-testid="acao-enviando"/);
  assert.match(src, /\{pendente && \(/, "a linha 'Enviando…' só aparece durante o envio");
  assert.match(src, /Enviando…/);
  assert.match(src, /querySelectorAll<HTMLButtonElement>\('button\[type="submit"\], button:not\(\[type\]\)'\)/, "os botões de envio do formulário");
  assert.match(src, /b\.disabled = pendente/, "desligados durante o envio e religados no fim");
});

test("E1091: um segundo envio com o primeiro em curso é ignorado (não entra na fila)", () => {
  assert.match(src, /if \(emCurso\.current\) return;\s*emCurso\.current = true;\s*executar\(dados\);/);
  assert.match(src, /emCurso\.current = pendente;/, "o envio em curso acaba quando a ação responde");
  // E818 de pé: o envio segue por onSubmit com o despacho que não limpa o formulário no erro.
  assert.match(src, /onSubmit=\{enviarSemLimpar\}/);
});
