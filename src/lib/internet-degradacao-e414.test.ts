/*
  E414 (degradação graciosa) — quando a medição de internet não conclui (conexão com o servidor de teste derrubada,
  bloqueador, firewall), o dono vê uma mensagem clara de tentar de novo, NADA é gravado nem marcado no imóvel, e ele
  pode seguir com o cadastro e medir depois. Teste permanente.
  Roda: node --test src/lib/internet-degradacao-e414.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FalhaMedicao, mensagemDaFalha, ROTULO_TENTAR_DE_NOVO, TEXTO_MEDIR_DEPOIS } from "./internet-motor.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("toda falha da medição diz o que fazer (tentar de novo, outra rede ou esperar) e traz o código", () => {
  const casos: unknown[] = [
    new FalhaMedicao("conexao", "latencia", 1500),
    new FalhaMedicao("travou", "download", 30000),
    new FalhaMedicao("limite", "latencia", 100, 429),
    new FalhaMedicao("servidor", "download", 100, 503),
    new FalhaMedicao("incompleto", "envio", 100),
    new FalhaMedicao("demorou", "download", 100),
    new Error("qualquer outra"),
  ];
  for (const e of casos) {
    const m = mensagemDaFalha(e);
    assert.match(m, /tente de novo|outra rede|aguarde|mais tarde/i, m);
    assert.match(m, /E414-/, m);
  }
});

test("o texto de 'medir depois' diz que nada foi registrado e que dá para seguir", () => {
  assert.match(TEXTO_MEDIR_DEPOIS, /nada foi registrado/i);
  assert.match(TEXTO_MEDIR_DEPOIS, /seguir/i);
  assert.match(TEXTO_MEDIR_DEPOIS, /medir depois/i);
  assert.equal(ROTULO_TENTAR_DE_NOVO, "Tentar de novo");
});

test("a falha sai ANTES de gravar: nenhuma medição é enviada ao servidor quando nenhuma rodada conclui", () => {
  const f = ler("components/anuncio/medir-internet.tsx");
  const iFalha = f.indexOf("return setResultado({ ok: false, erro: mensagemDaFalha(falha) })");
  const iGrava = f.indexOf('fetch("/api/internet/medicoes", {\n        method: "POST"');
  assert.ok(iFalha > -1 && iGrava > -1 && iFalha < iGrava, "o retorno da falha vem antes do POST da medição");
});

test("a tela oferece 'Tentar de novo' e 'Medir depois' após a falha, sem bloquear o resto do cadastro", () => {
  const f = ler("components/anuncio/medir-internet.tsx");
  assert.match(f, /data-testid="medir-internet-depois"/);
  assert.match(f, /TEXTO_MEDIR_DEPOIS/);
  assert.match(f, /ROTULO_TENTAR_DE_NOVO/);
  assert.match(f, /resultado && !resultado\.ok/);
  assert.match(f, /onDepois/);
  const n = ler("components/niveis/medir-no-imovel.tsx");
  assert.match(n, /onDepois=\{\(\) => setAberto\(false\)\}/, "no celular o painel fecha e o item fica pendente");
});

// E414 (complemento, re-prova de 06/11): o "Medir depois" aparecia só quando a tela chamadora passava `onDepois` (o painel do nível
// no celular). No cadastro, na edição e na conferência faltava o botão — só o texto "…medir depois…" dentro da frase.
test("'Medir depois' é um botão próprio em TODA tela que mede, ao lado de 'Tentar de novo'; sem onDepois, ele dispensa a falha", () => {
  const f = ler("components/anuncio/medir-internet.tsx");
  // O botão não depende mais de onDepois.
  assert.doesNotMatch(f, /\{onDepois && \(\s*<Button[^>]*medir-internet-depois-botao/);
  assert.match(f, /data-testid="medir-internet-depois-botao"/);
  assert.match(f, /const medirDepois = \(\) => \{\s*setResultado\(null\);\s*setAdiada\(true\);\s*onDepois\?\.\(\);\s*\}/);
  // Fica visível junto do "Tentar de novo" (mesma linha de botões), e não grava nada ao ser usado.
  const iBotoes = f.indexOf('data-testid="medir-internet-botao"');
  const iDepois = f.indexOf('data-testid="medir-internet-depois-botao"');
  assert.ok(iBotoes > -1 && iDepois > iBotoes);
  assert.match(f, /data-testid="medir-internet-adiada"/);
  const corpo = f.slice(f.indexOf("const medirDepois"), f.indexOf("const medirDepois") + 200);
  assert.doesNotMatch(corpo, /fetch\(/);
  // Começar a medir de novo apaga o aviso de "adiada".
  assert.match(f, /setAdiada\(false\);/);
});
