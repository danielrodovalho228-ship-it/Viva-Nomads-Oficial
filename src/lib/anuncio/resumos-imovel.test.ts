import test from "node:test";
import assert from "node:assert/strict";
import {
  destaquesDoImovel,
  descricaoPrecisaMostrarMais,
  linhasBomSaber,
  LIMITE_DESCRICAO_CURTA,
  PROTECOES_VIVA,
  RESUMO_SEGURANCA_SEM_DECLARACAO,
  SEGURANCA_SEM_DECLARACAO,
} from "./resumos-imovel.ts";
import { SAMPLE_PROPERTIES } from "../properties.ts";
import { achadosNoTexto } from "../varredura-texto.ts";
import { fraseInternetAnuncio } from "../internet.ts";
import type { Property } from "../types.ts";

const base = {
  proximities: undefined,
  readyToLiveBadge: false,
  tagHomeOffice: false,
  workFeatures: [],
  parkingSpots: 0,
  description: "",
} as unknown as Property;
const com = (p: Partial<Property>): Property => ({ ...base, ...p }) as Property;

test("sem dado real não há destaque (nada inventado)", () => {
  assert.deepEqual(destaquesDoImovel(base), []);
});

test("proximidade de saúde/educação cadastrada vira destaque, com o nome real", () => {
  const d = destaquesDoImovel(
    com({ proximities: [{ category: "saude", name: "HC-UFU", distanciaM: 820 }] }),
  );
  assert.equal(d.length, 1);
  assert.match(d[0].titulo, /HC-UFU/);
  assert.equal(d[0].detalhe, "a 800 m");
  // PERTO-B: só texto livre antigo (sem distância calculada) não vira destaque.
  assert.deepEqual(destaquesDoImovel(com({ proximities: [{ category: "saude", name: "HC-UFU", note: "10 min a pé" }] })), []);
});

test("máximo de 3 destaques, na ordem de prioridade", () => {
  const d = destaquesDoImovel(
    com({
      proximities: [
        { category: "saude", name: "Hospital A", distanciaM: 1200 },
        { category: "educacao", name: "Universidade B", distanciaM: 900 },
      ],
      readyToLiveBadge: true,
      tagHomeOffice: true,
      parkingSpots: 2,
    }),
  );
  assert.equal(d.length, 3);
  assert.match(d[0].titulo, /Hospital A/);
  assert.match(d[1].titulo, /Universidade B/);
  assert.equal(d[2].titulo, "Pronto para morar");
});

test("espaço de trabalho e vaga só aparecem com dado", () => {
  const d = destaquesDoImovel(com({ tagHomeOffice: true, parkingSpots: 1 }));
  assert.deepEqual(d.map((x) => x.chave), ["trabalho", "vaga"]);
  assert.equal(d[1].titulo, "1 vaga de garagem");
  assert.equal(destaquesDoImovel(com({ parkingSpots: 3 }))[0].titulo, "3 vagas de garagem");
});

test("proximidade de mercado/transporte não vira destaque", () => {
  assert.deepEqual(
    destaquesDoImovel(com({ proximities: [{ category: "mercado", name: "Mercado X" }] })),
    [],
  );
});

test("descrição curta não pede 'Mostrar mais'; longa pede", () => {
  assert.equal(descricaoPrecisaMostrarMais("curta"), false);
  assert.equal(descricaoPrecisaMostrarMais("a".repeat(LIMITE_DESCRICAO_CURTA)), false);
  assert.equal(descricaoPrecisaMostrarMais("a".repeat(LIMITE_DESCRICAO_CURTA + 1)), true);
  assert.equal(descricaoPrecisaMostrarMais(undefined), false);
});

test("Bom saber: 4 linhas fixas (a manutenção entra no bloco), sem inventar regra", () => {
  const l = linhasBomSaber(com({ maxGuests: 2, petsAllowed: false, checkinAfter: "14:00", checkoutBefore: "11:00" }));
  assert.deepEqual(l.map((x) => x.chave), ["cancelamento", "regras", "seguranca", "manutencao"]);
  // E98-A: o compromisso de manutenção vem da mesma fonte do texto antigo, um prazo por linha.
  assert.equal(l[3].titulo, "Manutenção");
  assert.equal(l[3].resumo, "Urgente com solução provisória em até 24 h e definitiva em até 72 h");
  assert.deepEqual(l[3].detalhe.slice(1), ["Comum em até 72 h", "Demais em até 7 dias"]);
  // CAMPOS-1: o resumo fica curto (os 2 primeiros fatos); entrada e saída seguem no detalhe.
  assert.equal(l[1].resumo, "Até 2 pessoas · sem pets");
  assert.ok(l[1].detalhe.includes("Entrada a partir das 14:00"));
  assert.ok(l[1].detalhe.includes("Saída até às 11:00"));
});

test("Segurança: proteções da Viva sempre; sem declaração, convida a perguntar pelo chat", () => {
  const vazio = linhasBomSaber(base)[2];
  assert.equal(vazio.resumo, RESUMO_SEGURANCA_SEM_DECLARACAO);
  assert.doesNotMatch(vazio.resumo + vazio.detalhe.join(" "), /não informad/i);
  assert.deepEqual(vazio.detalhe, [...PROTECOES_VIVA, SEGURANCA_SEM_DECLARACAO]);
  const decl = linhasBomSaber(
    com({
      privacidade: {
        semCamerasInterior: true,
        camerasExternas: "portaria",
        tipoAcesso: "chave",
        senhaTrocadaEstadia: false,
      },
    }),
  )[2];
  assert.match(decl.resumo, /Sem câmeras no interior/);
  assert.match(decl.resumo, /portaria/);
  assert.match(decl.resumo, /Acesso: Chave/);
  // Proteções da Viva primeiro, depois o que o anunciante declarou.
  assert.deepEqual(decl.detalhe.slice(0, PROTECOES_VIVA.length), [...PROTECOES_VIVA]);
  assert.ok(decl.detalhe.includes("Acesso: Chave"));
  assert.ok(!decl.detalhe.includes(SEGURANCA_SEM_DECLARACAO));
});

test("Cancelamento: nada é cobrado antes do contrato; Caução e saída antecipada sem regra nova", () => {
  const c = linhasBomSaber(base)[0];
  assert.equal(c.resumo, "Antes do contrato assinado, nada é cobrado");
  const t = c.detalhe.join(" ");
  assert.match(t, /contrato assinado pelas duas partes/);
  assert.match(t, /Antes da assinatura, nada é cobrado/);
  assert.match(t, /Caução fica registrada.*conferência de saída/);
  assert.match(t, /saída antecipada estão no contrato/);
  assert.match(t, /nunca retém o valor mensal/);
});

test("gavetas do Bom saber sem palavra proibida — base e os 15 anúncios de exemplo (t118 não abre gavetas)", () => {
  for (const p of [base, ...SAMPLE_PROPERTIES]) {
    for (const l of linhasBomSaber(p)) {
      const texto = [l.titulo, l.resumo, ...l.detalhe].join("\n");
      assert.deepEqual(achadosNoTexto(texto, { termos: true, vocabulario: true }), [], `${p.id ?? "base"} · ${l.chave}`);
    }
  }
});

test("os 15 anúncios de exemplo declaram câmeras e acesso (Segurança nunca cai no 'a confirmar')", () => {
  assert.equal(SAMPLE_PROPERTIES.length, 15);
  for (const p of SAMPLE_PROPERTIES) {
    const seg = linhasBomSaber(p)[2];
    assert.notEqual(seg.resumo, RESUMO_SEGURANCA_SEM_DECLARACAO, p.id);
    assert.match(seg.resumo, /Sem câmeras no interior/, p.id);
    assert.match(seg.resumo, /Acesso:/, p.id);
  }
});

test("ube-005: a internet aparece só como 'Internet fibra' (sem 'Internet boa')", () => {
  const p = SAMPLE_PROPERTIES.find((x) => x.id === "ube-005")!;
  const frase = fraseInternetAnuncio(p.internetTier!, [...(p.workFeatures ?? []), ...(p.amenities ?? [])]);
  assert.match(frase, /^Internet fibra/);
  assert.doesNotMatch(frase, /Internet boa/);
  // Sem fibra declarada, a frase da categoria não muda (nada inventado).
  assert.match(fraseInternetAnuncio("trabalho_remoto", ["Wi-Fi"]), /^Internet para trabalho remoto, informada pelo proprietário \(não medida\)/);
});

test("texto não promete cancelamento nem chama de temporada/art. 48", () => {
  const todos = linhasBomSaber(base).map((x) => x.resumo + x.detalhe.join(" ")).join(" ");
  assert.doesNotMatch(todos, /temporada|art\. ?48|8\.245|apartamento|vistoria/i);
});
