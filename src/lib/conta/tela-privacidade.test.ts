/*
  A5 — Conta › Privacidade (mockup perfil-05): chaves, padrão do desenho e o arquivo de "Baixar meus dados".
  Roda: node --test src/lib/conta/tela-privacidade.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHAVES_PRIVACIDADE, COLUNAS_EXPORT_AVALIACOES, COLUNAS_EXPORT_CONTRATOS, COLUNAS_EXPORT_LEADS, RODAPE_PRIVACIDADE, limparLinha, normalizarPrivacidade } from "./tela-privacidade.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("as três chaves do desenho, na ordem, e o rodapé", () => {
  assert.deepEqual(CHAVES_PRIVACIDADE.map((c) => c.titulo), [
    "Mostrar meu perfil para proprietários",
    "Aparecer nas buscas da Viva",
    "Compartilhar dados de uso para melhorar o app",
  ]);
  assert.equal(RODAPE_PRIVACIDADE, "Você pode alterar essas permissões a qualquer momento nas configurações.");
});

test("sem preferência gravada vale o padrão do desenho; só booleano conta", () => {
  assert.deepEqual(normalizarPrivacidade(null), { mostrar_perfil: true, aparecer_busca: true, dados_uso: false });
  assert.deepEqual(normalizarPrivacidade({ mostrar_perfil: false, dados_uso: "sim" }), { mostrar_perfil: false, aparecer_busca: true, dados_uso: false });
});

test("o arquivo nunca leva token, segredo ou senha", () => {
  assert.deepEqual(limparLinha({ id: "1", full_name: "Ana", push_token: "x", totp_secret: "y", senha_hash: "z" }), { id: "1", full_name: "Ana" });
  assert.equal(limparLinha(null), null);
});

test("Baixar meus dados: só a sessão da própria pessoa, sem cliente admin, sem log e sem cache", () => {
  const rota = ler("src/app/api/conta/meus-dados/route.ts");
  assert.doesNotMatch(rota, /createAdminClient|service_role/);
  assert.doesNotMatch(rota, /console\.|logger/);
  assert.match(rota, /"Cache-Control": "private, no-store"/);
  assert.match(rota, /attachment; filename=/);
  assert.match(rota, /status: 401/);
});

test("a tela: chaves gravam na hora, Baixar meus dados e Excluir minha conta como no desenho", () => {
  const tela = ler("src/components/account/tela-privacidade.tsx");
  assert.match(tela, /href="\/api\/conta\/meus-dados"/);
  assert.match(tela, /href="\/dashboard\/conta\/excluir"/);
  assert.match(tela, /setPrivacidade\(/);
  assert.doesNotMatch(tela, /window\.confirm|alert\(/);
});

test("o arquivo não leva taxa, plano, faixa, notas privadas nem motivo da equipe", () => {
  const todas = [COLUNAS_EXPORT_CONTRATOS, COLUNAS_EXPORT_LEADS, COLUNAS_EXPORT_AVALIACOES].join(", ");
  assert.doesNotMatch(todas, /comiss|taxa|faixa|plan|cobranca|nota_privada|moderacao|reject_reason|\*/);
  const rota = ler("src/app/api/conta/meus-dados/route.ts");
  // Tabelas com grant por coluna: nunca select("*") (perfil, Pix e pedidos são da própria pessoa, todas as colunas).
  assert.doesNotMatch(rota, /from\("(contratos|leads|avaliacoes|properties)"\)\.select\("\*"\)/);
  assert.match(rota, /\.not\("publicada_em", "is", null\)/);
});
