import test from "node:test";
import assert from "node:assert/strict";
import {
  destaquesDoImovel,
  descricaoPrecisaMostrarMais,
  linhasBomSaber,
  LIMITE_DESCRICAO_CURTA,
} from "./resumos-imovel.ts";
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
    com({ proximities: [{ category: "saude", name: "HC-UFU", note: "10 min a pé" }] }),
  );
  assert.equal(d.length, 1);
  assert.match(d[0].titulo, /HC-UFU/);
  assert.equal(d[0].detalhe, "~10 min a pé");
});

test("máximo de 3 destaques, na ordem de prioridade", () => {
  const d = destaquesDoImovel(
    com({
      proximities: [
        { category: "saude", name: "Hospital A" },
        { category: "educacao", name: "Universidade B" },
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

test("Bom saber: 3 linhas fixas, sem inventar regra", () => {
  const l = linhasBomSaber(com({ maxGuests: 2, petsAllowed: false, checkinAfter: "14:00", checkoutBefore: "11:00" }));
  assert.deepEqual(l.map((x) => x.chave), ["cancelamento", "regras", "seguranca"]);
  assert.match(l[1].resumo, /14:00/);
  assert.match(l[1].resumo, /2 pessoas/);
  assert.match(l[1].resumo, /sem pets/i);
});

test("Segurança: só o que o anunciante declarou; sem declaração, diz isso", () => {
  const vazio = linhasBomSaber(base)[2];
  assert.match(vazio.resumo, /não informad/i);
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
});

test("texto não promete cancelamento nem chama de temporada/art. 48", () => {
  const todos = linhasBomSaber(base).map((x) => x.resumo + x.detalhe.join(" ")).join(" ");
  assert.doesNotMatch(todos, /temporada|art\. ?48|8\.245|apartamento|vistoria/i);
});
