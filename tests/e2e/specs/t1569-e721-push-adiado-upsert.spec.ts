import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1569 — E721 (#3466, migração 0332): o push adiado pelo silêncio (22h–7h) agrupa mensagens da mesma conversa com
  `upsert(..., { onConflict: "user_id,grupo" })`. Antes (índice parcial da 0226) isso dava 42P10 ("não há restrição única que corresponda") e o aviso
  das 7h se perdia. Guarda de BANCO no laboratório (todas as migrações aplicadas): o mesmo upsert, pelo mesmo caminho (PostgREST), funciona,
  a 2ª mensagem do grupo SUBSTITUI a 1ª (uma linha só), e linhas com grupo nulo continuam livres. Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `push.t1569.${sufixo}@lab.vivanomads.test`, nome: "Paula Push", role: "tenant" as const };
const ids: Record<string, string> = {};
const sairEm = () => new Date(Date.now() + 3_600_000).toISOString();

test.describe("T1569 — E721: upsert de push_adiados por (user_id, grupo)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  test.beforeAll(async () => {
    ids.u = await criarConta(conta, senha);
  });
  test.afterAll(async () => {
    if (ids.u) await adm().from("push_adiados").delete().eq("user_id", ids.u);
    await apagarContas([ids.u]);
  });

  test("a 2ª mensagem do mesmo grupo substitui a 1ª, sem erro 42P10", async () => {
    const base = { user_id: ids.u, evento: "mensagem", grupo: `conversa-${sufixo}`, sair_em: sairEm() };
    const a = await adm().from("push_adiados").upsert({ ...base, titulo: "1 nova mensagem", corpo: "primeira" }, { onConflict: "user_id,grupo" });
    expect(a.error, JSON.stringify(a.error)).toBeNull();
    const b = await adm().from("push_adiados").upsert({ ...base, titulo: "2 novas mensagens", corpo: "segunda" }, { onConflict: "user_id,grupo" });
    expect(b.error, JSON.stringify(b.error)).toBeNull();
    const { data } = await adm().from("push_adiados").select("titulo, corpo").eq("user_id", ids.u).eq("grupo", base.grupo);
    expect(data).toEqual([{ titulo: "2 novas mensagens", corpo: "segunda" }]);
  });

  test("grupo nulo continua livre: duas linhas sem grupo convivem", async () => {
    const linha = { user_id: ids.u, evento: "aviso", titulo: "aviso", corpo: "x", grupo: null, sair_em: sairEm() };
    const r1 = await adm().from("push_adiados").insert(linha);
    const r2 = await adm().from("push_adiados").insert(linha);
    expect(r1.error).toBeNull();
    expect(r2.error, "NULL é distinto no índice único").toBeNull();
  });
});
