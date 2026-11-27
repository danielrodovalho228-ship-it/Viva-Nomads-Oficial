/* Roda: node --test src/lib/perfil/e403-medidor-estavel.test.ts
  E403 (vigia): o medidor do perfil ia de 88% de manhã a 86% à tarde, sem ação nenhuma e com o MESMO item faltando
  (Documento/CPF): 7 de 8 → 6 de 7 — um item SAIU da conta. Dois itens entravam e saíam por leitura volátil:
   • "Celular verificado": a sonda do provedor de SMS (rede, 4 s) falhava → "indisponível" guardado por 10 min → o item
     sumia, mesmo para quem JÁ verificou;
   • "Profissão": dependia de a conta ter algum imóvel (um rascunho tirava o item).
  Agora a lista do medidor só muda por ação da pessoa: quem verificou o celular tem o item feito sempre; a falha da
  sonda não apaga o último resultado bom; "Profissão" segue o cadastro (morador), não a existência de imóvel.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { itemTelefoneNoMedidor, medidorPerfil, pedeProfissao, progressoPerfil } from "./perfil-publico.ts";

test("celular: verificado conta como feito mesmo com a sonda do SMS fora; sem verificar, só entra se der para verificar", () => {
  assert.equal(itemTelefoneNoMedidor({ disponivel: false, verificado: true }), true);
  assert.equal(itemTelefoneNoMedidor({ disponivel: true, verificado: true }), true);
  assert.equal(itemTelefoneNoMedidor({ disponivel: true, verificado: false }), false);
  assert.equal(itemTelefoneNoMedidor({ disponivel: false, verificado: false }), undefined);
  assert.equal(itemTelefoneNoMedidor(null), undefined);
});

test("profissão: segue o cadastro de morador — ter (ou não) um imóvel na conta não muda a lista", () => {
  assert.equal(pedeProfissao("tenant"), true);
  assert.equal(pedeProfissao("owner"), false);
  assert.equal(pedeProfissao(null), false);
});

test("o caso do relato: mesma pessoa (celular verificado, só o documento faltando) dá a MESMA % com a sonda no ar ou fora", () => {
  const cadastro = [
    { chave: "nome", rotulo: "Nome", feito: true },
    { chave: "email", rotulo: "E-mail confirmado", feito: true },
    { chave: "documento", rotulo: "Documento (CPF)", feito: false },
  ];
  const perfil = { foto: true, bio: "Engenheira em mudança", idiomas: ["pt"], cidade: "Uberlândia", profissao: "engenharia", motivo: null };
  const pct = (disponivel: boolean) =>
    medidorPerfil(progressoPerfil(perfil, { anuncia: !pedeProfissao("tenant"), telefone: itemTelefoneNoMedidor({ disponivel, verificado: true }) }).itens, cadastro).pct;
  assert.equal(pct(true), pct(false));
});

test("a leitura do perfil usa as duas regras; a sonda do SMS não guarda a falha por cima do último resultado bom", () => {
  const acoes = readFileSync("src/lib/data/perfil-actions.ts", "utf8");
  assert.match(acoes, /telefone: itemTelefoneNoMedidor\(fone\)/);
  assert.match(acoes, /anuncia: !pedeProfissao\(/);
  const sonda = readFileSync("src/lib/telefone/disponibilidade.ts", "utf8");
  assert.match(sonda, /if \(falhou\) return \{ disponivel: cache\?\.pronto \?\? false, simulado: false \};/);
});
