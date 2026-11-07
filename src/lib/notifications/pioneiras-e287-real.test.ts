/* E287 — envio REAL às duas pioneiras (Opção A): regras do caminho mínimo. Roda: node --test src/lib/notifications/pioneiras-e287-real.test.ts */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { ASSUNTO_PIONEIRAS, PIONEIRAS } from "./pioneiras-e287.ts";
import { ID_PIONEIRA, enviarPioneiraReal, type DepsEnvioReal } from "./pioneiras-e287-real.ts";

const MARIA = "maria-de-fatima" as const;
const LYA = "lya-raquel" as const;

function deps(over: Partial<DepsEnvioReal> = {}) {
  const chaves = new Set<string>([`boas_vindas:${ID_PIONEIRA[MARIA]}`, `boas_vindas:${ID_PIONEIRA[LYA]}`]);
  const enviados: Parameters<DepsEnvioReal["enviar"]>[0][] = [];
  const d: DepsEnvioReal = {
    perfil: async (id) => ({ email: id === ID_PIONEIRA[MARIA] ? "Fatima.Alves.Campanha@gmail.com" : "lyamercaldi@gmail.com", role: id === ID_PIONEIRA[MARIA] ? "owner" : "tenant", is_teste: false }),
    existeChave: async (c) => chaves.has(c),
    reservar: async (c) => (chaves.has(c) ? "ja" : (chaves.add(c), "ok")),
    liberar: async (c) => void chaves.delete(c),
    enviar: async (p) => (enviados.push(p), { demo: false, id: "re_" + enviados.length }),
    agora: () => new Date("2026-11-07T14:00:00Z"),
    ...over,
  };
  return { d, chaves, enviados };
}

test("assunto EXATO, remetente oficial, sem comMarca (interno), sem usuarioId (não grava na caixa de teste)", async () => {
  const { d, enviados } = deps();
  const r = await enviarPioneiraReal(d, MARIA);
  assert.equal(r.ok, true);
  const e = enviados[0];
  assert.equal(e.subject, "Você foi uma das primeiras 💚 — novidades da Viva Nomads");
  assert.equal(e.subject, ASSUNTO_PIONEIRAS);
  assert.equal(e.to, "fatima.alves.campanha@gmail.com");
  assert.equal(e.interno, true);
  assert.equal(e.from, "Viva Nomads Brasil <suporte@vivanomads.com.br>");
  assert.equal(e.replyTo, "suporte@vivanomads.com.br");
  assert.equal(e.usuarioId, undefined);
  assert.match(e.html, /email-mark\.png/);
  assert.match(e.text ?? "", /^Olá, Maria de Fátima!/);
  assert.match(e.text ?? "", /É só responder 'topo'\./);
});

test("só estas duas pessoas existem; os ids são os das marcas gravadas", () => {
  assert.deepEqual(Object.values(ID_PIONEIRA).sort(), ["47ca91e1-456f-4de2-8d7d-1251e6d74c96", "693e53ed-a4cd-49c4-be05-c76a7da2be38"]);
  assert.equal(PIONEIRAS.length, 2);
});

test("a ordem é obrigatória: a Lya só depois do envio aceito da Maria de Fátima", async () => {
  const { d, enviados } = deps();
  const r = await enviarPioneiraReal(d, LYA);
  assert.equal(r.ok, false);
  assert.equal(enviados.length, 0);
  assert.equal((await enviarPioneiraReal(d, MARIA)).ok, true);
  assert.equal((await enviarPioneiraReal(d, LYA)).ok, true);
  assert.equal(enviados.length, 2);
});

test("um envio por pessoa: o segundo pedido não envia de novo", async () => {
  const { d, enviados } = deps();
  await enviarPioneiraReal(d, MARIA);
  const r = await enviarPioneiraReal(d, MARIA);
  assert.equal(r.ok, false);
  assert.equal(enviados.length, 1);
});

test("para se a conta não confere (e-mail, papel, conta de teste, marca ausente) e não envia nada", async () => {
  for (const p of [
    { email: "outra@pessoa.com", role: "owner", is_teste: false },
    { email: "fatima.alves.campanha@gmail.com", role: "tenant", is_teste: false },
    { email: "fatima.alves.campanha@gmail.com", role: "owner", is_teste: true },
  ]) {
    const { d, enviados } = deps({ perfil: async () => p });
    assert.equal((await enviarPioneiraReal(d, MARIA)).ok, false);
    assert.equal(enviados.length, 0);
  }
  const sem = deps({ existeChave: async () => false });
  assert.equal((await enviarPioneiraReal(sem.d, MARIA)).ok, false);
  assert.equal(sem.enviados.length, 0);
});

test("leitura que falha não vira envio", async () => {
  const { d, enviados } = deps({ perfil: async () => "falha" });
  assert.equal((await enviarPioneiraReal(d, MARIA)).ok, false);
  assert.equal(enviados.length, 0);
});

test("envio recusado ou simulado libera a reserva (pode tentar de novo) e não conta como enviado", async () => {
  for (const res of [{ demo: false, error: "Resend 403" }, { demo: true }]) {
    const { d, chaves } = deps({ enviar: async () => res });
    const r = await enviarPioneiraReal(d, MARIA);
    assert.equal(r.ok, false);
    assert.equal(chaves.has("pioneiras_e287_envio:maria-de-fatima"), false);
  }
});

test("devolve o id do Resend e o horário; NUNCA toca nas marcas de boas-vindas", async () => {
  const { d, chaves } = deps();
  const antes = [...chaves].filter((c) => c.startsWith("boas_vindas:")).sort();
  const r = await enviarPioneiraReal(d, MARIA);
  assert.ok(r.ok && r.resendId === "re_1" && r.em === "2026-11-07T14:00:00.000Z");
  assert.deepEqual([...chaves].filter((c) => c.startsWith("boas_vindas:")).sort(), antes);
  const fonte = readFileSync("src/lib/notifications/pioneiras-e287-real.ts", "utf8");
  assert.doesNotMatch(fonte, /AUTOMACOES_ATIVO|\.delete\(\)[\s\S]{0,80}boas_vindas|VN-CT-D5D50247/);
});

test("a rota é só de admin, só POST, e só aceita as duas chaves", () => {
  const rota = readFileSync("src/app/api/admin/pioneiras-e287/route.ts", "utf8");
  assert.match(rota, /ehAdmin\(/);
  assert.match(rota, /export async function POST/);
  assert.doesNotMatch(rota, /export async function (GET|PUT|PATCH|DELETE)/);
  assert.match(rota, /ID_PIONEIRA/);
  assert.doesNotMatch(rota, /to:\s*(body|corpo|req)/);
});
