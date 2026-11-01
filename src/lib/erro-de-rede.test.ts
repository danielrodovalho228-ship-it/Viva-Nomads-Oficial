/*
  Telas de envio sem texto cru do navegador quando a conexão cai (auditoria de erros e estados vazios, achado nº 1).
  Roda: node --test src/lib/erro-de-rede.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG_SEM_CONEXAO, ehErroDeRede, textoDoErro } from "./erro-de-rede.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const PADRAO = "Não foi possível enviar o documento agora.";

test("a conexão caiu: o texto de cada navegador (computador e celular) vira a frase em português", () => {
  const quedas = [
    new TypeError("Failed to fetch"), // Chrome, Edge, Chrome do Android
    new TypeError("Load failed"), // Safari no Mac e no iPhone/iPad
    new TypeError("NetworkError when attempting to fetch resource."), // Firefox
    new TypeError("Network request failed"), // WebView
    new TypeError("fetch failed"), // Node/undici (ação do servidor)
    new Error("The Internet connection appears to be offline."), // Safari antigo
    new Error("An unexpected response was received from the server."), // ação do servidor sem resposta
  ];
  for (const e of quedas) {
    assert.equal(ehErroDeRede(e), true, e.message);
    assert.equal(textoDoErro(e, PADRAO), MSG_SEM_CONEXAO, e.message);
  }
  assert.equal(MSG_SEM_CONEXAO, "A conexão caiu. Confira a internet e tente de novo.");
  assert.doesNotMatch(MSG_SEM_CONEXAO, /fetch|failed|load|network/i);
});

test("a mensagem lançada por nós (o motivo devolvido pela API) continua aparecendo", () => {
  assert.equal(textoDoErro(new Error("Envie um PDF ou uma foto de até 10 MB."), PADRAO), "Envie um PDF ou uma foto de até 10 MB.");
  assert.equal(ehErroDeRede(new Error("Documento ilegível: envie outra foto.")), false);
});

test("outro erro técnico, ou nada útil, vira a frase padrão da tela — nunca o texto cru", () => {
  assert.equal(textoDoErro(new SyntaxError("Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"), PADRAO), PADRAO);
  const abortado = new Error("The user aborted a request.");
  abortado.name = "AbortError";
  assert.equal(textoDoErro(abortado, PADRAO), PADRAO);
  assert.equal(textoDoErro(new TypeError("Cannot read properties of undefined (reading 'path')"), PADRAO), PADRAO);
  assert.equal(textoDoErro(new Error("   "), PADRAO), PADRAO);
  assert.equal(textoDoErro("Failed to fetch", PADRAO), PADRAO, "string solta não é Error");
  assert.equal(textoDoErro(null, PADRAO), PADRAO);
  assert.equal(textoDoErro(undefined, PADRAO), PADRAO);
});

test("as telas de envio passam o erro pela regra (documento, vínculo, matrícula, vídeo e foto de perfil)", () => {
  const telas = [
    "src/components/documento-uploader.tsx",
    "src/components/anuncio/documento-vinculo.tsx",
    "src/components/anuncio/matricula-resultado.tsx",
    "src/components/video-uploader.tsx",
    "src/components/account/foto-perfil.tsx",
  ];
  for (const t of telas) {
    const src = ler(t);
    assert.match(src, /from "@\/lib\/erro-de-rede"/, t);
    assert.match(src, /textoDoErro\(e, "/, t);
    assert.doesNotMatch(src, /e instanceof Error \? e\.message/, `${t}: nada de e.message cru na tela`);
  }
  // A confirmação de identidade (CAF) do vínculo não deixa a promessa rejeitar: sem conexão, devolve a frase.
  const vinculo = ler("src/components/anuncio/documento-vinculo.tsx");
  assert.match(vinculo, /fetch\("\/api\/caf\/verify", \{ method: "POST" \}\)\.catch\(\(\) => null\);\n\s*if \(!res\) return MSG_SEM_CONEXAO;/);
  // Vídeo: sem conexão, o botão "Tentar de novo" fica com o mesmo arquivo.
  assert.match(ler("src/components/video-uploader.tsx"), /arquivo: tentarDeNovo \|\| ehErroDeRede\(e\) \? file : null/);
});
