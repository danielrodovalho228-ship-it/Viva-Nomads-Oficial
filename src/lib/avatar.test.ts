import { test } from "node:test";
import assert from "node:assert/strict";
import {
  iniciais,
  corAvatar,
  podeVerAvatar,
  relacaoAceita,
  AVATAR_PALETTE,
} from "./avatar.ts";

test("iniciais: até 2, determinísticas", () => {
  assert.equal(iniciais("Marcos Andrade"), "MA");
  assert.equal(iniciais("Ana"), "A");
  assert.equal(iniciais("  joão pedro silva "), "JS");
  assert.equal(iniciais(""), "?");
});

test("corAvatar: determinística e dentro da paleta", () => {
  const c1 = corAvatar("Marcos Andrade");
  assert.equal(c1, corAvatar("Marcos Andrade")); // estável
  assert.ok((AVATAR_PALETTE as readonly string[]).includes(c1));
  // nomes diferentes tendem a cores diferentes (não garantido, mas testa variedade)
  const cores = new Set(["Ana", "Bruno", "Carla", "Diego", "Elisa", "Felipe"].map(corAvatar));
  assert.ok(cores.size >= 2);
});

test("relacaoAceita: só estados da lista", () => {
  assert.equal(relacaoAceita("aceita_para_conversa"), true);
  assert.equal(relacaoAceita("assinado"), true);
  assert.equal(relacaoAceita("nova"), false);
  assert.equal(relacaoAceita("em_analise"), false);
  assert.equal(relacaoAceita(null), false);
  assert.equal(relacaoAceita(undefined), false);
});

test("podeVerAvatar: o próprio dono sempre vê", () => {
  assert.equal(podeVerAvatar({ viewerId: "u1", targetId: "u1", targetPapel: "tenant" }), true);
});

test("podeVerAvatar: admin vê tudo (moderação)", () => {
  assert.equal(
    podeVerAvatar({ viewerId: "adm", targetId: "u2", targetPapel: "tenant", viewerIsAdmin: true }),
    true
  );
});

test("podeVerAvatar: foto de PROPRIETÁRIO é pública", () => {
  assert.equal(podeVerAvatar({ viewerId: "u1", targetId: "u2", targetPapel: "owner" }), true);
  // até sem relação nenhuma
  assert.equal(podeVerAvatar({ viewerId: "x", targetId: "y", targetPapel: "owner" }), true);
});

test("podeVerAvatar: INQUILINO oculto ANTES do aceite", () => {
  assert.equal(
    podeVerAvatar({ viewerId: "own", targetId: "inq", targetPapel: "tenant", estadoRelacao: "nova" }),
    false
  );
  assert.equal(
    podeVerAvatar({ viewerId: "own", targetId: "inq", targetPapel: "tenant", estadoRelacao: undefined }),
    false
  );
});

test("podeVerAvatar: INQUILINO visível DEPOIS do aceite", () => {
  assert.equal(
    podeVerAvatar({ viewerId: "own", targetId: "inq", targetPapel: "tenant", estadoRelacao: "aceita_para_conversa" }),
    true
  );
  assert.equal(
    podeVerAvatar({ viewerId: "own", targetId: "inq", targetPapel: "tenant", estadoRelacao: "assinado" }),
    true
  );
});

test("podeVerAvatar: 'conversando sem aceite' NÃO libera", () => {
  // estado de conversa sem aceite explícito
  assert.equal(
    podeVerAvatar({ viewerId: "own", targetId: "inq", targetPapel: "tenant", estadoRelacao: "vista" }),
    false
  );
});

// ── 10 FORMAS DIFERENTES simulando dados ─────────────────────────────────────
// Cada linha é um "banco" simulado (viewer, target, papel, estado, admin, self)
// exercitando uma combinação distinta da regra de visibilidade + render.
type Cenario = {
  n: number;
  desc: string;
  ctx: Parameters<typeof podeVerAvatar>[0];
  esperado: boolean;
};

const CENARIOS: Cenario[] = [
  {
    n: 1,
    desc: "Marcos (proprietário) visto por visitante deslogado-ish sem relação → PÚBLICO",
    ctx: { viewerId: "visitante-1", targetId: "marcos", targetPapel: "owner" },
    esperado: true,
  },
  {
    n: 2,
    desc: "Ana (inquilina) vista pelo proprietário ANTES de responder pedido (estado 'nova') → OCULTA",
    ctx: { viewerId: "marcos", targetId: "ana", targetPapel: "tenant", estadoRelacao: "nova" },
    esperado: false,
  },
  {
    n: 3,
    desc: "Ana (inquilina) DEPOIS de aceitar conversa ('aceita_para_conversa') → VISÍVEL ao proprietário",
    ctx: { viewerId: "marcos", targetId: "ana", targetPapel: "tenant", estadoRelacao: "aceita_para_conversa" },
    esperado: true,
  },
  {
    n: 4,
    desc: "Bruno olhando a PRÓPRIA foto (viewer === target) → sempre VÊ",
    ctx: { viewerId: "bruno", targetId: "bruno", targetPapel: "tenant", estadoRelacao: "nova" },
    esperado: true,
  },
  {
    n: 5,
    desc: "Admin (moderação) sobre inquilina sem relação nenhuma → VÊ tudo",
    ctx: { viewerId: "admin-1", targetId: "carla", targetPapel: "tenant", viewerIsAdmin: true },
    esperado: true,
  },
  {
    n: 6,
    desc: "Contrato ASSINADO entre partes ('assinado') → foto da inquilina liberada",
    ctx: { viewerId: "marcos", targetId: "diego", targetPapel: "tenant", estadoRelacao: "assinado" },
    esperado: true,
  },
  {
    n: 7,
    desc: "Conversa em andamento SEM aceite ('vista') → ainda OCULTA (não basta conversar)",
    ctx: { viewerId: "marcos", targetId: "elisa", targetPapel: "tenant", estadoRelacao: "vista" },
    esperado: false,
  },
  {
    n: 8,
    desc: "Inquilino olhando OUTRO inquilino (nunca há relação de aceite entre pares) → OCULTA",
    ctx: { viewerId: "felipe", targetId: "gustavo", targetPapel: "tenant", estadoRelacao: undefined },
    esperado: false,
  },
  {
    n: 9,
    desc: "Proprietário visto por inquilino já em contrato ('contrato') → PÚBLICO de qualquer forma",
    ctx: { viewerId: "ana", targetId: "marcos", targetPapel: "owner", estadoRelacao: "contrato" },
    esperado: true,
  },
  {
    n: 10,
    desc: "Candidatura 'aceito' (documento aceito) sobre inquilina → VISÍVEL",
    ctx: { viewerId: "marcos", targetId: "helena", targetPapel: "tenant", estadoRelacao: "aceito" },
    esperado: true,
  },
];

test("podeVerAvatar: 10 formas diferentes simulando dados", () => {
  assert.equal(CENARIOS.length, 10, "devem existir exatamente 10 cenários");
  for (const c of CENARIOS) {
    assert.equal(
      podeVerAvatar(c.ctx),
      c.esperado,
      `Cenário ${c.n} — ${c.desc}: esperado ${c.esperado}`
    );
  }
});

test("render: cada cenário produz iniciais + cor determinística estável", () => {
  // Simula o que o componente Avatar faria com o nome de cada alvo: as iniciais
  // e a cor são estáveis entre renders (mesma pessoa → mesma cor sempre).
  const nomes = ["Marcos Andrade", "Ana", "Bruno Lopes", "Carla", "Diego Reis", "Elisa Mota"];
  for (const nome of nomes) {
    const ini = iniciais(nome);
    assert.ok(ini.length >= 1 && ini.length <= 2, `iniciais de "${nome}" fora de 1..2`);
    assert.equal(ini, ini.toUpperCase(), "iniciais sempre maiúsculas");
    // determinismo: 3 chamadas seguidas dão o mesmo resultado
    assert.equal(corAvatar(nome), corAvatar(nome));
    assert.equal(corAvatar(nome), corAvatar(nome));
    assert.ok((AVATAR_PALETTE as readonly string[]).includes(corAvatar(nome)));
  }
});
