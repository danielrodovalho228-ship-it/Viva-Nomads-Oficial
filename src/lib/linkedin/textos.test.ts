/*
  63-A — telas do selo "LinkedIn conectado": textos exatos, o selo é um componente único e nunca link, nunca no cartão do
  imóvel, a confirmação de 1 passo sem janela do navegador e tudo atrás da chave.
  Roda: node --test src/lib/linkedin/textos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MSG_CANCELADO,
  MSG_JA_CONECTADO,
  MSG_NOME_DIVERGENTE,
  RETORNO_LINKEDIN,
  ROTA_CONECTAR,
  SELO_LINKEDIN,
  TEXTO_DESCONECTAR,
  TEXTO_OPCIONAL,
  TEXTO_O_QUE_E,
  ehSeloLinkedin,
  retornoLinkedin,
} from "./textos.ts";
import * as regras from "./regras.ts";
import { TEXTO_PROIBIDO } from "../estilo/estilo-padrao.test.ts";

const raiz = new URL("../../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(raiz + p, "utf8");
const semComentarios = (f: string) => f.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const SELO = ler("src/components/confianca/selo-linkedin.tsx");
const CONTA = ler("src/components/account/conta-blocos.tsx");
/** Onde o selo de pessoa aparece (63-A item 3): candidatura, proposta, conversa, avaliação, perfil público e o dono no imóvel. */
const USOS = [
  "src/app/(dashboard)/dashboard/leads/leads-client.tsx",
  "src/app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx",
  "src/app/(dashboard)/dashboard/mensagens/messages-client.tsx",
  "src/components/property/reviews.tsx",
  "src/app/(public)/proprietario/[id]/page.tsx",
  "src/components/property/faixa-proprietario.tsx",
  "src/components/property/owner-card.tsx",
];

test("textos exatos da Conta e do selo", () => {
  assert.equal(SELO_LINKEDIN, "LinkedIn conectado");
  assert.equal(TEXTO_O_QUE_E, "Mostra aos outros que você tem um LinkedIn com o mesmo nome desta conta. Ninguém vê seu perfil do LinkedIn.");
  assert.equal(TEXTO_DESCONECTAR, "O selo sai do seu perfil agora. Você pode conectar de novo quando quiser.");
  assert.equal(TEXTO_OPCIONAL, "Opcional");
  assert.equal(ROTA_CONECTAR, "/api/conta/linkedin/conectar");
  for (const t of [SELO_LINKEDIN, TEXTO_O_QUE_E, TEXTO_DESCONECTAR, ...Object.values(RETORNO_LINKEDIN).flatMap((r) => [r.titulo, r.texto ?? ""])]) assert.doesNotMatch(t, TEXTO_PROIBIDO);
});

test("retorno do fluxo: sucesso e as 3 falhas com a causa e 'Tentar de novo'", () => {
  assert.deepEqual(retornoLinkedin("?linkedin=conectado"), RETORNO_LINKEDIN.conectado);
  assert.equal(RETORNO_LINKEDIN.conectado.titulo, "LinkedIn conectado");
  assert.equal(RETORNO_LINKEDIN.conectado.tentarDeNovo, false);
  const falhas = { nome: MSG_NOME_DIVERGENTE, outra: MSG_JA_CONECTADO, cancelado: MSG_CANCELADO } as const;
  for (const [k, causa] of Object.entries(falhas)) {
    const r = retornoLinkedin(`linkedin=${k}`)!;
    assert.equal(r.ok, false);
    assert.equal(r.texto, causa);
    assert.equal(r.tentarDeNovo, true, k);
  }
  assert.equal(MSG_NOME_DIVERGENTE, "O nome no LinkedIn não confere com o nome da sua conta.");
  assert.equal(MSG_JA_CONECTADO, "Este LinkedIn já está conectado a outra conta.");
  assert.equal(MSG_CANCELADO, "Você cancelou a conexão com o LinkedIn. Nada foi gravado.");
  assert.equal(retornoLinkedin("?linkedin=qualquer"), null);
  assert.equal(retornoLinkedin(""), null);
  assert.match(CONTA, /linkedin-tentar-de-novo/);
});

test("regras.ts (63-B) reexporta os mesmos textos; as telas do navegador não importam regras.ts (node:crypto)", () => {
  assert.equal(regras.SELO_LINKEDIN, SELO_LINKEDIN);
  assert.equal(regras.MSG_NOME_DIVERGENTE, MSG_NOME_DIVERGENTE);
  assert.equal(regras.MSG_JA_CONECTADO, MSG_JA_CONECTADO);
  for (const f of [SELO, CONTA]) assert.doesNotMatch(f, /linkedin\/regras/);
});

test("o selo é um componente único, nunca link, sem nada do LinkedIn, com pesos 400/600", () => {
  const s = semComentarios(SELO);
  assert.doesNotMatch(s, /<a\b|<Link\b|href=/);
  assert.doesNotMatch(s, /font-medium|font-bold/);
  assert.match(s, /data-testid="selo-linkedin"/);
  assert.match(s, /\{SELO_LINKEDIN\}/);
  assert.equal(ehSeloLinkedin("LinkedIn conectado"), true);
  assert.equal(ehSeloLinkedin("E-mail confirmado"), false);
  for (const p of USOS) {
    const f = semComentarios(ler(p));
    assert.match(f, /<SeloLinkedin\b/, `${p} usa o componente único`);
    // O selo nunca fica dentro de um link: nenhum <SeloLinkedin> entre um <a>/<Link> aberto e o fechamento.
    assert.doesNotMatch(f, /<(a|Link)\b[^>]*>(?:(?!<\/(a|Link)>)[\s\S])*<SeloLinkedin\b/, `${p}: selo dentro de link`);
  }
});

test("nunca no cartão do imóvel", () => {
  for (const p of ["src/components/property-card.tsx", "src/lib/cartao-sintese.ts", "src/lib/selos.ts"]) {
    let f = "";
    try {
      f = ler(p);
    } catch {
      continue;
    }
    assert.doesNotMatch(f, /SeloLinkedin|linkedin/i, p);
  }
});

test("Conta: estado, 'Conectar', 'Desconectar' com confirmação de 1 passo na própria tela, atrás da chave", () => {
  const c = semComentarios(CONTA);
  assert.match(c, /TEXTO_O_QUE_E/);
  assert.match(c, /TEXTO_DESCONECTAR/);
  assert.match(c, /linkedin-desconectar-confirma/);
  assert.match(c, /linkedin-desconectar-cancela/);
  assert.doesNotMatch(c, /window\.confirm|\balert\(|confirm\(/);
  // A linha só existe com a chave (meuLinkedin().ativo = LINKEDIN_CONECTAR_ATIVO + configuração).
  assert.match(c, /\.\.\.\(linkedin\?\.ativo/);
  assert.match(c, /avisoLinkedin && linkedin\?\.ativo/);
});

test("E64 (QA 24/10): Meus dados sem o campo de URL do LinkedIn — o selo é a conexão, não um endereço digitado", () => {
  assert.doesNotMatch(ler("src/components/account/conta-secoes.tsx"), /Endereço do perfil no LinkedIn|setLinkedin/);
});
