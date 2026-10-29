import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FAQ } from "../atendimento/faq.ts";
import { TEMAS_AJUDA, perguntasDoTema, temaAjuda } from "./temas.ts";
import { HREF_FALE_COM_A_VIVA, destinoDoAtendimento } from "./rotas.ts";
import { ancoraDaSecao, rotuloDoIndice } from "./indice-legal.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const conta = (texto: string, trecho: string) => texto.split(trecho).length - 1;

test("E84: os 4 cartões de tema do mockup, e cada pergunta citada existe na FAQ (fonte única)", () => {
  assert.deepEqual(
    TEMAS_AJUDA.map((t) => t.titulo),
    ["Para quem procura moradia", "Para proprietários", "Contratos e pagamentos", "Segurança e conta"],
  );
  const ids = new Set(FAQ.map((p) => p.id));
  for (const t of TEMAS_AJUDA) {
    assert.ok(t.perguntas.length > 0, t.id);
    for (const p of t.perguntas) assert.ok(ids.has(p), `${t.id}: ${p}`);
  }
  assert.deepEqual(perguntasDoTema("contratos"), ["caucao", "renovar", "manutencao", "prazo"]);
  assert.equal(perguntasDoTema(null).length, FAQ.length);
  assert.equal(temaAjuda("nao-existe"), null);
});

test("E84: os textos dos temas usam o vocabulário aprovado (o mockup falava de check-in, reserva e taxa de limpeza)", () => {
  const texto = TEMAS_AJUDA.map((t) => `${t.titulo} ${t.resumo} ${t.alt}`).join(" ").toLowerCase();
  for (const proibida of ["temporada", "hóspede", "reserva", "check-in", "comissão", "inquilino", "aluguel", "limpeza", "whatsapp"]) {
    assert.ok(!texto.includes(proibida), proibida);
  }
});

test("E84: links antigos do atendimento (?novo=1, ?chamado=…, e-mails) seguem para a página própria; o hub abre normal", () => {
  assert.equal(destinoDoAtendimento({}), null);
  assert.equal(destinoDoAtendimento({ tema: "morador" }), null);
  assert.equal(destinoDoAtendimento({ novo: "1" }), `${HREF_FALE_COM_A_VIVA}?novo=1`);
  assert.equal(destinoDoAtendimento({ chamado: "VN-000100", tema: "x" }), `${HREF_FALE_COM_A_VIVA}?chamado=VN-000100`);
  assert.equal(destinoDoAtendimento({ contexto: "contrato", id: "abc" }), `${HREF_FALE_COM_A_VIVA}?contexto=contrato&id=abc`);
  assert.equal(destinoDoAtendimento({ pessoa: "VN-1", s: "x y" }), `${HREF_FALE_COM_A_VIVA}?pessoa=VN-1&s=x+y`);
  assert.equal(destinoDoAtendimento({ imovel: "VN-UBE001" }), `${HREF_FALE_COM_A_VIVA}?imovel=VN-UBE001`);
});

test("E84: a promessa de atendimento aparece UMA vez por página (antes, 4× na /ajuda)", () => {
  const hub = ler("app/(public)/ajuda/page.tsx");
  const fale = ler("app/(public)/ajuda/fale-com-a-viva/page.tsx");
  assert.equal(conta(hub, "{PROMESSA_ATENDIMENTO}"), 1);
  assert.equal(conta(fale, "{PROMESSA_ATENDIMENTO}"), 1);
  // O rodapé do site não repete a frase (estaria 2× na /ajuda e na Fale com a Viva).
  assert.equal(conta(ler("components/layout/footer.tsx"), "PROMESSA_ATENDIMENTO"), 0);
  // O atendimento e o bloco do chat não repetem a frase na mesma página.
  assert.equal(conta(ler("components/ajuda/central-ajuda.tsx"), "PROMESSA_ATENDIMENTO"), 0);
  assert.match(ler("components/ajuda/viva-chat.tsx"), /<PainelChat altura="h-\[420px\]" semPromessa \/>/);
  // Cada destino tem a sua página: o hub não traz mais o chat nem o formulário de chamado.
  assert.doesNotMatch(hub, /VivaChatBloco|<CentralAjuda/);
  assert.match(fale, /<VivaChatBloco \/>/);
  assert.match(fale, /<CentralAjuda canal="site" \/>/);
});

test("E84: Termos e Privacidade na moldura própria, com o texto de antes (só a moldura e as âncoras mudaram)", () => {
  for (const p of ["app/(public)/termos/page.tsx", "app/(public)/privacidade/page.tsx"]) {
    const src = ler(p);
    assert.match(src, /<PaginaLegal titulo=/);
    assert.match(src, /id=\{ancoraDaSecao\(title\)\}/);
  }
  assert.equal(ancoraDaSecao("3. Pagamento do aluguel"), "secao-3");
  assert.equal(ancoraDaSecao("10. Cookies"), "secao-10");
  assert.equal(ancoraDaSecao("5."), "secao-5");
  assert.equal(rotuloDoIndice("8. Seus direitos (LGPD)"), "Seus direitos (LGPD)");
});

test("E84: 'Fale com a Viva' (menu do site, Conta › Ajuda, telas de decisão) abre a página própria", () => {
  assert.match(ler("lib/constants.ts"), /FALE_COM_A_VIVA = \{ href: "\/ajuda\/fale-com-a-viva"/);
  assert.match(ler("lib/conta/ajuda.ts"), /id: "fale", rotulo: "Fale com a Viva", href: "\/ajuda\/fale-com-a-viva"/);
  assert.match(ler("components/ajuda/falar-com-a-viva.tsx"), /href="\/ajuda\/fale-com-a-viva"/);
});
