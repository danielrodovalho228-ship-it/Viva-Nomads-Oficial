/* Roda: node --test src/lib/notifications/pioneiras-e287.test.ts — E287: e-mail das pioneiras (assunto manual exato, prova só para a conta de teste). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ASSUNTO_PIONEIRAS, PIONEIRAS, emailPioneira, textoPioneira } from "./pioneiras-e287.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const envio = ler("./pioneiras-e287-envio.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("o assunto é o manual aprovado, EXATO, sem o sufixo de marca", () => {
  assert.equal(ASSUNTO_PIONEIRAS, "Você foi uma das primeiras 💚 — novidades da Viva Nomads");
  for (const p of PIONEIRAS) {
    const e = emailPioneira(p);
    assert.equal(e.subject, ASSUNTO_PIONEIRAS);
    assert.doesNotMatch(e.subject, /·\s*Viva Nomads$/);
  }
});

test("HTML no modelo único: logo email-mark.png, saudação certa de cada pioneira, parágrafos e assinatura aprovados", () => {
  const maria = emailPioneira(PIONEIRAS[0]);
  const lya = emailPioneira(PIONEIRAS[1]);
  for (const e of [maria, lya]) {
    assert.match(e.html, /https:\/\/vivanomads\.com\.br\/email-mark\.png/);
    assert.match(e.html, /Um abraço,<br><strong>Equipe Viva Nomads<\/strong><br>/);
    assert.match(e.html, /É só responder 'topo'\./);
  }
  assert.match(maria.html, /Olá, Maria de Fátima!/);
  assert.match(maria.html, /como proprietária quando a plataforma/);
  assert.match(maria.html, /do lado de quem anuncia/);
  assert.match(lya.html, /Olá, Lya Raquel!/);
  assert.match(lya.html, /procurando um lugar para morar quando a plataforma/);
  assert.match(lya.html, /do lado de quem procura moradia/);
  assert.doesNotMatch(maria.html, /Lya/);
  assert.doesNotMatch(lya.html, /Maria de Fátima/);
});

test("o texto puro é exatamente o aprovado e os arquivos de prova do repo são os gerados (sem deriva)", () => {
  for (const p of PIONEIRAS) {
    const e = emailPioneira(p);
    assert.equal(e.text, textoPioneira(p));
    assert.equal(ler(`../../../docs/e287/prova-${p.chave}.txt`), e.text);
    assert.equal(ler(`../../../docs/e287/prova-${p.chave}.html`), e.html);
  }
  assert.equal(
    textoPioneira(PIONEIRAS[0]),
    "Olá, Maria de Fátima!\n\nAqui é da equipe Viva Nomads. Você se cadastrou como proprietária quando a plataforma ainda estava saindo do papel — obrigado por confiar desde o começo.\n\nEstamos na reta final dos testes e o lançamento oficial é entre janeiro e fevereiro de 2027. Antes de abrir para todo mundo, queremos montar um grupo pequeno de pioneiros para testar o app e opinar de verdade, do lado de quem anuncia. Quem participar entra antes de todo mundo e fala direto com a nossa equipe.\n\nPosso te chamar quando o teste para proprietários abrir? É só responder 'topo'.\n\nUm abraço,\nEquipe Viva Nomads\nvivanomads.com.br\n",
  );
});

test("o envio de PROVA: pela pilha oficial, sem comMarca, remetente oficial, e SÓ para a conta de teste", () => {
  assert.match(envio, /import \{ sendEmail, type EmailResult \} from "\.\/email\.ts";/);
  assert.match(envio, /export const DESTINO_PROVA = "proprietario1@vivanomads\.com\.br";/);
  assert.match(envio, /to: DESTINO_PROVA,/);
  assert.match(envio, /interno: true,/);
  assert.match(envio, /from: REMETENTE,/);
  assert.match(envio, /replyTo: REMETENTE_EMAIL,/);
  assert.doesNotMatch(envio, /comMarca/);
  // nenhum caminho de envio real: nenhuma destinatária real como destino
  for (const p of PIONEIRAS) assert.doesNotMatch(envio, new RegExp(p.email.replace(/\./g, "\\.")));
  assert.doesNotMatch(envio, /to: p\.email|to: pioneira/);
  // o sendEmail só pula o comMarca no modo interno
  assert.match(ler("./email.ts"), /subject: params\.interno \? params\.subject : comMarca\(params\.subject\)/);
  // o remetente oficial é o de cliente
  assert.match(ler("./remetente.ts"), /REMETENTE_NOME = "Viva Nomads Brasil"/);
  assert.match(ler("../site.ts"), /SUPORTE_EMAIL/);
});
