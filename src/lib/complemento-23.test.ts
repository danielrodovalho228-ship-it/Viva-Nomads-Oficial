/* Complemento do prompt 23 (reteste do Muse, 18/10): endereço da visita, horário que não some, cartão de verificação. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { enderecoDaVisita, linhaEnderecoExato, mostraEnderecoDaVisita, FOLGA_ENDERECO_MS } from "./visitas/endereco-visita.ts";
import { cartaoVerificacao } from "./cartao-verificacao.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("item 1 — endereço só na presencial CONFIRMADA e até a visita passar", () => {
  const agora = new Date("2026-10-20T12:00:00Z");
  const conf = { modalidade: "presencial", status: "confirmado", horarioConfirmado: "2026-10-21T18:00:00Z" };
  assert.equal(mostraEnderecoDaVisita(conf, agora), true);
  assert.equal(mostraEnderecoDaVisita({ ...conf, status: "pedido" }, agora), false, "antes da confirmação: só a região");
  assert.equal(mostraEnderecoDaVisita({ ...conf, status: "cancelado" }, agora), false, "cancelada: volta à região");
  assert.equal(mostraEnderecoDaVisita({ ...conf, modalidade: "video" }, agora), false);
  const passou = new Date(Date.parse(conf.horarioConfirmado) + FOLGA_ENDERECO_MS + 1);
  assert.equal(mostraEnderecoDaVisita(conf, passou), false, "passou da data: volta à região");
});

test("item 1 — rua, número, complemento e bairro + 'Abrir no mapa'", () => {
  const linha = linhaEnderecoExato(" Rua Modesta Maria ", "120", "apto 302");
  assert.equal(linha, "Rua Modesta Maria, 120, apto 302");
  const e = enderecoDaVisita({ exact_address: linha, address: "Saraiva", city: "Uberlândia", state: "MG" })!;
  assert.equal(e.texto, "Rua Modesta Maria, 120, apto 302 · Saraiva · Uberlândia");
  assert.match(e.mapa, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Rua%20Modesta%20Maria%2C%20120/);
  assert.equal(enderecoDaVisita({ exact_address: "", address: "Saraiva", city: "Uberlândia" }), null, "sem rua gravada não inventa endereço");
});

test("item 1 — a rua sai do rascunho para a coluna restrita (o rascunho é apagado ao publicar)", () => {
  const acoes = ler("./data/actions.ts");
  assert.equal((acoes.match(/\.\.\.colunaEnderecoExato\(input\.enderecoExato\)/g) ?? []).length, 2, "criar e atualizar");
  assert.match(ler("../app/(dashboard)/dashboard/imoveis/novo/page.tsx"), /enderecoExato: linhaEnderecoExato\(street, numero, complemento\)/);
  assert.match(ler("../app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx"), /data-testid="editar-endereco-exato"/);
  const visitas = ler("./data/visitas-video-actions.ts");
  assert.match(visitas, /quem === "dono" && modalidade === "presencial"/, "o e-mail com endereço vai só ao morador");
  assert.match(visitas, /Abrir no mapa/);
});

test("item 2 — o horário tem chave estável e não é campo controlado (não some quando outro campo muda)", () => {
  const tela = ler("../components/property/visita-video.tsx");
  assert.match(tela, /key=\{h\.id\}/);
  assert.match(tela, /defaultValue=\{h\.valor\}/);
  assert.doesNotMatch(tela, /key=\{i\}/);
  assert.doesNotMatch(tela, /value=\{h\}/);
  assert.match(tela, /const \[\{ min, max \}\] = useState\(/, "limites calculados uma vez");
});

test("item 3 — cartão da Visão geral com o estado real do laudo", () => {
  const ok = cartaoVerificacao({ teste: true, feita: true, ok: true, validoAte: "2027-10-18T15:00:00Z" });
  assert.equal(ok.estado, "confirmada");
  assert.equal(ok.titulo, "Identidade confirmada · válida até 18/10/2027");
  const teste = cartaoVerificacao({ teste: true, feita: false, ok: false, validoAte: null });
  assert.equal(teste.cta.label, "Verificar (simulado)");
  const real = cartaoVerificacao({ teste: false, feita: false, ok: false, validoAte: null });
  assert.match(real.titulo, /em breve/);
  assert.match(cartaoVerificacao(null).titulo, /em breve/);
  assert.match(ler("../components/dashboard/tenant-onboarding.tsx"), /fetch\("\/api\/caf\/status"\)/);
});
