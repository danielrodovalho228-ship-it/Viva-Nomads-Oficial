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
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

// E1091 reforço (ORDEM-DUET-620): a trava lê só o CÓDIGO. Com os comentários, "Enviando…" casava com o cabeçalho de
// form-acao.tsx e a trava continuava verde com o texto da tela trocado (mutação da ORDEM-DUET-618).
const src = semComentarios(readFileSync(new URL("../../components/vistoria/form-acao.tsx", import.meta.url), "utf8"));

test("E1091: enquanto envia, o formulário diz 'Enviando…' e os botões de envio ficam desligados", () => {
  // A linha "Enviando…" é a do próprio aviso de envio: só durante o envio, com role="status" e o texto da casa.
  assert.match(
    src,
    /\{pendente && \(\s*<p role="status"[^>]*data-testid="acao-enviando">\s*Enviando…\s*<\/p>\s*\)\}/,
    "durante o envio, o aviso diz 'Enviando…'",
  );
  assert.match(src, /querySelectorAll<HTMLButtonElement>\('button\[type="submit"\], button:not\(\[type\]\)'\)/, "os botões de envio do formulário");
  // E1117 (perna 3, ORDEM-DUET-514): antes esta linha exigia `b.disabled = pendente` — desligava e religava TODO botão
  // de envio, também o que a página mostra desativado ("Concluir a visita" enquanto falta foto), já na montagem.
  // Agora: desliga durante o envio e, no fim, religa só o que ele mesmo desligou.
  assert.match(src, /if \(pendente\) \{\s*if \(b\.disabled\) return;\s*b\.disabled = true;\s*b\.setAttribute\(DESLIGADO_PELO_ENVIO, ""\);/, "desligados durante o envio");
  assert.match(src, /\} else if \(b\.hasAttribute\(DESLIGADO_PELO_ENVIO\)\) \{\s*b\.disabled = false;\s*b\.removeAttribute\(DESLIGADO_PELO_ENVIO\);/, "religados no fim, só os que o envio desligou");
  assert.doesNotMatch(src, /b\.disabled = pendente/, "nunca religa o botão que a página desativou");
});

test("E1091: um segundo envio com o primeiro em curso é ignorado (não entra na fila)", () => {
  assert.match(src, /if \(emCurso\.current\) return;\s*emCurso\.current = true;\s*executar\(dados\);/);
  assert.match(src, /emCurso\.current = pendente;/, "o envio em curso acaba quando a ação responde");
  // E818 de pé: o envio segue por onSubmit com o despacho que não limpa o formulário no erro.
  assert.match(src, /onSubmit=\{enviarSemLimpar\}/);
});
