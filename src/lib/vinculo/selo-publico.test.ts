/* Roda: node --test src/lib/vinculo/selo-publico.test.ts — E174-B (selo do vínculo profissional nos contextos de confiança). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dominioDoSelo, ehSeloVinculo, seloVinculoPublico } from "./textos.ts";
import { cartaoCandidato, selosReais } from "../perfil/perfil-publico.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("o selo público é 'Vínculo profissional · <domínio>' e nunca leva um e-mail", () => {
  assert.equal(seloVinculoPublico("hospital.org.br"), "Vínculo profissional · hospital.org.br");
  assert.equal(seloVinculoPublico("Hospital.Org.BR"), "Vínculo profissional · hospital.org.br");
  assert.equal(seloVinculoPublico("ana@hospital.org.br"), null);
  assert.equal(seloVinculoPublico(""), null);
  assert.equal(seloVinculoPublico(null), null);
  assert.equal(ehSeloVinculo("Vínculo profissional · hospital.org.br"), true);
  assert.equal(ehSeloVinculo("LinkedIn conectado"), false);
  assert.equal(dominioDoSelo("Vínculo profissional · hospital.org.br"), "hospital.org.br");
});

test("perfil público e candidatura: o selo entra com os outros selos reais, só quando confirmado", () => {
  assert.deepEqual(selosReais({ emailConfirmado: true, vinculoDominio: "empresa.com.br" }), ["E-mail confirmado", "Vínculo profissional · empresa.com.br"]);
  assert.deepEqual(selosReais({ emailConfirmado: true, vinculoDominio: null }), ["E-mail confirmado"]);
  const base = { nome: "Ana Souza", fotoUrl: null, profissao: null, motivo: null, inicioDesejado: null, pets: 0, desde: null, reputacao: null, emailConfirmado: false };
  // Antes do aceite também: o domínio não identifica a pessoa (sem nome, foto ou contato).
  assert.deepEqual(cartaoCandidato({ ...base, vinculoDominio: "universidade.edu.br" }, false).selos, ["Vínculo profissional · universidade.edu.br"]);
});

test("o servidor lê só o domínio das linhas confirmadas; as telas usam o componente único", () => {
  const srv = ler("lib/vinculo/servidor.ts").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(srv, /select\("user_id, dominio"\)/);
  assert.match(srv, /not\("confirmado_em", "is", null\)/);
  assert.doesNotMatch(srv, /codigo_hash|email|tentativas/);
  for (const f of [
    "app/(public)/proprietario/[id]/page.tsx",
    "components/property/owner-card.tsx",
    "components/property/faixa-proprietario.tsx",
    "app/(dashboard)/dashboard/leads/leads-client.tsx",
    "app/(dashboard)/dashboard/mensagens/messages-client.tsx",
    "app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx",
    "components/property/reviews.tsx",
  ])
    assert.match(ler(f), /<SeloVinculo /, f);
});
