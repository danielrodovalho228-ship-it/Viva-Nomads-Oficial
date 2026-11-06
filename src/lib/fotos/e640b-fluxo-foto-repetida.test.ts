/*
  E640 (b) — teste de FLUXO da foto repetida: o cadastro de uma conta real, com uma foto igual (ou quase) à de OUTRA conta real,
  roda o código de verdade (ligarHashesAoImovel → registrarFotoRepetida → fatosDosImoveis → prontidaoAnuncio) sobre um banco em
  memória. Só as portas de fora são falsas (Supabase, aviso). A consulta fotos_parecidas é a da 0309 reescrita aqui com a MESMA
  regra (outra conta, as duas reais, distância de Hamming ≤ limite); o SQL em si é guardado por e640b-foto-repetida.test.ts.
  Roda: node --test src/lib/fotos/e640b-fluxo-foto-repetida.test.ts
*/
import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { BancoFalso } from "../testes/banco-falso.ts";

register("../testes/carregador-alias.mjs", import.meta.url);

type Estado = { avisos: Record<string, unknown>[]; admins: unknown[]; servico?: unknown };
const dubles = () => ((globalThis as unknown as { __dubles: Estado }).__dubles ??= { avisos: [], admins: [] });

const DONA_A = "aaaaaaaa-0000-4000-8000-000000000001";
const DONO_B = "bbbbbbbb-0000-4000-8000-000000000002";
const DONO_TESTE = "cccccccc-0000-4000-8000-000000000003";
const IMOVEL_A = "a1a1a1a1-0000-4000-8000-000000000011";
const IMOVEL_B = "b2b2b2b2-0000-4000-8000-000000000022";
const IMOVEL_T = "c3c3c3c3-0000-4000-8000-000000000033";
const HASH_A = "f0f0f0f0f0f0f0f0";
const HASH_A_QUASE = "f0f0f0f0f0f0f0f3"; // 2 bits de diferença
const HASH_OUTRA_FOTO = "0f0f0f0f0f0f0f0f"; // 64 bits de diferença
const url = (c: string) => `https://x.supabase.co/storage/v1/object/public/property-photos/${c}`;

let banco: BancoFalso;
let m: {
  ligar: (a: unknown, id: string, urls: string[]) => Promise<void>;
  fatos: (c: unknown, owner: string, ids: string[]) => Promise<Map<string, { fotoRepetidaAberta?: boolean }>>;
  prontidao: (f: never) => { podePublicar: boolean; faltam: string[]; obrigatorios: { key: string; ok: boolean }[] };
  hamming: (a: string, b: string) => number;
  limite: number;
};

before(async () => {
  const [fa, ps, pr, fr] = await Promise.all([
    import("@/lib/minimizacao/fotos-anuncio"),
    import("@/lib/anuncio/prontidao-servidor"),
    import("@/lib/anuncio/prontidao"),
    import("@/lib/fotos/foto-repetida"),
  ]);
  m = { ligar: fa.ligarHashesAoImovel as never, fatos: ps.fatosDosImoveis as never, prontidao: pr.prontidaoAnuncio as never, hamming: fr.distanciaHamming, limite: fr.LIMITE_BITS_FOTO_PARECIDA };
});

beforeEach(() => {
  banco = new BancoFalso();
  const d = dubles();
  d.avisos.length = 0;
  d.admins = [{ email: "admin@vivanomads.test", full_name: "Admin", notif_email: true }];
  d.servico = banco.servico();
  banco.tabelas.profiles = [
    { id: DONA_A, is_teste: false },
    { id: DONO_B, is_teste: false },
    { id: DONO_TESTE, is_teste: true },
  ];
  banco.tabelas.properties = [
    { id: IMOVEL_A, owner_id: DONA_A, status: "active", foto_repetida_em: null },
    { id: IMOVEL_B, owner_id: DONO_B, status: "draft", foto_repetida_em: null, title: "Casa", description: "" },
    { id: IMOVEL_T, owner_id: DONO_TESTE, status: "draft", foto_repetida_em: null },
  ];
  banco.tabelas.fotos_anuncio_hash = [{ caminho: "a/casa.webp", hash: HASH_A, owner_id: DONA_A, property_id: IMOVEL_A }];
  // fotos_parecidas (0309): outra conta, as duas contas reais, distância ≤ p_max.
  banco.rpcs.fotos_parecidas = ({ p_property, p_max }) => {
    const hashes = banco.tabela("fotos_anuncio_hash");
    const real = (id: unknown) => banco.tabela("profiles").some((p) => p.id === id && !p.is_teste);
    const saida: unknown[] = [];
    for (const a of hashes.filter((h) => h.property_id === p_property)) {
      for (const b of hashes) {
        if (b.owner_id === a.owner_id || b.caminho === a.caminho || !real(a.owner_id) || !real(b.owner_id)) continue;
        const dist = m.hamming(String(a.hash), String(b.hash));
        if (dist <= Number(p_max)) saida.push({ caminho: a.caminho, outro_caminho: b.caminho, outro_owner: b.owner_id, outro_property: b.property_id, distancia: dist });
      }
    }
    return saida;
  };
});

const cadastrarFoto = (dono: string, imovel: string, caminho: string, hash: string) => {
  banco.tabela("fotos_anuncio_hash").push({ caminho, hash, owner_id: dono, property_id: null });
  return m.ligar(banco.servico(), imovel, [url(caminho)]);
};
const prontidaoDe = async (dono: string, imovel: string) => {
  const f = (await m.fatos(banco.servico(), dono, [imovel])).get(imovel);
  assert.ok(f, "fatos do imóvel");
  return { fatos: f, p: m.prontidao(f as never) };
};

test("foto igual à de OUTRA conta real: alerta ao admin, imóvel marcado e publicação travada", async () => {
  await cadastrarFoto(DONO_B, IMOVEL_B, "b/casa-copiada.webp", HASH_A);

  const alertas = banco.tabela("fotos_repetidas_alertas");
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].property_id, IMOVEL_B);
  assert.equal(alertas[0].owner_id, DONO_B);
  assert.equal(alertas[0].outro_owner_id, DONA_A);
  assert.equal(alertas[0].outro_property_id, IMOVEL_A);
  assert.equal(alertas[0].distancia, 0);

  assert.ok(banco.tabela("properties").find((p) => p.id === IMOVEL_B)?.foto_repetida_em, "o imóvel fica marcado");
  const avisos = dubles().avisos;
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].email, "admin@vivanomads.test");
  assert.equal(avisos[0].pushUrl, "/admin/documentos");

  const { fatos, p } = await prontidaoDe(DONO_B, IMOVEL_B);
  assert.equal(fatos.fotoRepetidaAberta, true);
  assert.equal(p.podePublicar, false);
  const item = p.obrigatorios.find((o) => o.key === "foto_repetida");
  assert.ok(item && !item.ok, "o item da prontidão aparece e não está cumprido");
  assert.ok(p.faltam.some((t) => /matrícula/i.test(t)));
});

test("foto QUASE igual (2 bits) também trava; foto de outro ambiente (64 bits) não", async () => {
  await cadastrarFoto(DONO_B, IMOVEL_B, "b/casa-recortada.webp", HASH_A_QUASE);
  assert.equal(banco.tabela("fotos_repetidas_alertas").length, 1);
  assert.equal(banco.tabela("fotos_repetidas_alertas")[0].distancia, 2);
  assert.equal((await prontidaoDe(DONO_B, IMOVEL_B)).fatos.fotoRepetidaAberta, true);

  banco = new BancoFalso();
  dubles().servico = banco.servico();
  // refaz o cenário com uma foto realmente diferente
  banco.tabelas.profiles = [{ id: DONA_A, is_teste: false }, { id: DONO_B, is_teste: false }];
  banco.tabelas.properties = [{ id: IMOVEL_A, owner_id: DONA_A, status: "active" }, { id: IMOVEL_B, owner_id: DONO_B, status: "draft" }];
  banco.tabelas.fotos_anuncio_hash = [{ caminho: "a/casa.webp", hash: HASH_A, owner_id: DONA_A, property_id: IMOVEL_A }];
  banco.rpcs.fotos_parecidas = ({ p_property, p_max }) =>
    banco
      .tabela("fotos_anuncio_hash")
      .filter((h) => h.property_id === p_property)
      .flatMap((a) =>
        banco
          .tabela("fotos_anuncio_hash")
          .filter((b) => b.owner_id !== a.owner_id && m.hamming(String(a.hash), String(b.hash)) <= Number(p_max))
          .map((b) => ({ caminho: a.caminho, outro_caminho: b.caminho, outro_owner: b.owner_id, outro_property: b.property_id, distancia: 0 })),
      );
  dubles().avisos.length = 0;
  await cadastrarFoto(DONO_B, IMOVEL_B, "b/outra-sala.webp", HASH_OUTRA_FOTO);
  assert.equal(banco.tabela("fotos_repetidas_alertas").length, 0);
  assert.equal(dubles().avisos.length, 0);
  assert.notEqual((await prontidaoDe(DONO_B, IMOVEL_B)).fatos.fotoRepetidaAberta, true);
});

test("a trava só cai com a matrícula CONFERIDA (em revisão ou recusada não libera)", async () => {
  await cadastrarFoto(DONO_B, IMOVEL_B, "b/casa-copiada.webp", HASH_A);
  assert.equal((await prontidaoDe(DONO_B, IMOVEL_B)).fatos.fotoRepetidaAberta, true);

  for (const resultado of ["em_revisao", "recusado", "pendente"]) {
    banco.tabelas.property_ownership_checks = [{ property_id: IMOVEL_B, user_id: DONO_B, resultado }];
    assert.equal((await prontidaoDe(DONO_B, IMOVEL_B)).fatos.fotoRepetidaAberta, true, `resultado ${resultado} não libera`);
  }
  banco.tabelas.property_ownership_checks = [{ property_id: IMOVEL_B, user_id: DONO_B, resultado: "conferido" }];
  const livre = await prontidaoDe(DONO_B, IMOVEL_B);
  assert.notEqual(livre.fatos.fotoRepetidaAberta, true);
  assert.ok(!livre.p.obrigatorios.some((o) => o.key === "foto_repetida"));
});

test("reenviar a mesma foto não duplica o alerta nem o aviso ao admin", async () => {
  await cadastrarFoto(DONO_B, IMOVEL_B, "b/casa-copiada.webp", HASH_A);
  await m.ligar(banco.servico(), IMOVEL_B, [url("b/casa-copiada.webp")]);
  assert.equal(banco.tabela("fotos_repetidas_alertas").length, 1);
  assert.equal(dubles().avisos.length, 1);
});

test("a mesma foto na MESMA conta (outro anúncio do dono) e a foto de conta de TESTE não disparam alerta", async () => {
  banco.tabela("properties").push({ id: "b9b9b9b9-0000-4000-8000-000000000099", owner_id: DONO_B, status: "draft" });
  banco.tabela("fotos_anuncio_hash").push({ caminho: "b/mesma.webp", hash: HASH_A, owner_id: DONO_B, property_id: "b9b9b9b9-0000-4000-8000-000000000099" });
  await cadastrarFoto(DONO_B, IMOVEL_B, "b/mesma-conta.webp", "f0f0f0f0f0f0f0f0");
  // o único outro dono com a foto é a Dona A (real) → alerta; então apaga A e deixa só a própria conta
  banco.tabelas.fotos_repetidas_alertas = [];
  banco.tabela("properties").find((p) => p.id === IMOVEL_B)!.foto_repetida_em = null;
  banco.tabelas.fotos_anuncio_hash = banco.tabela("fotos_anuncio_hash").filter((h) => h.owner_id === DONO_B);
  dubles().avisos.length = 0;
  await m.ligar(banco.servico(), IMOVEL_B, [url("b/mesma-conta.webp")]);
  assert.equal(banco.tabela("fotos_repetidas_alertas").length, 0, "mesma conta não é fraude");

  // conta de teste copiando a foto da Dona A: fora da checagem (real × real)
  banco.tabelas.fotos_anuncio_hash = [{ caminho: "a/casa.webp", hash: HASH_A, owner_id: DONA_A, property_id: IMOVEL_A }];
  await cadastrarFoto(DONO_TESTE, IMOVEL_T, "t/copia.webp", HASH_A);
  assert.equal(banco.tabela("fotos_repetidas_alertas").length, 0, "conta de teste não gera alerta");
  assert.equal(dubles().avisos.length, 0);
});

test("anúncio JÁ publicado não é travado depois (a trava vale para quem ainda vai publicar)", async () => {
  banco.tabela("properties").find((p) => p.id === IMOVEL_B)!.status = "active";
  await cadastrarFoto(DONO_B, IMOVEL_B, "b/casa-copiada.webp", HASH_A);
  assert.notEqual((await prontidaoDe(DONO_B, IMOVEL_B)).fatos.fotoRepetidaAberta, true);
});

test("falha na consulta nunca derruba o cadastro (best-effort)", async () => {
  banco.rpcs.fotos_parecidas = () => {
    throw new Error("banco fora do ar");
  };
  await assert.doesNotReject(cadastrarFoto(DONO_B, IMOVEL_B, "b/x.webp", HASH_A));
  assert.equal(banco.tabela("fotos_repetidas_alertas").length, 0);
});
