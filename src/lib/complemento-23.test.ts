/* Complemento do prompt 23 (reteste do Muse, 18/10): endereço da visita, horário que não some, cartão de verificação. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { enderecoDaVisita, linhaEnderecoExato, mostraEnderecoDaVisita, FOLGA_ENDERECO_MS } from "./visitas/endereco-visita.ts";
import { estadoIdentidadeDe } from "./identidade/estado.ts";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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

const laudo = (valid_until: string, extra: Record<string, unknown> = {}) => ({
  caf_result: { identity: true, document: true, liveness: true, light: "green", ...extra },
  traffic_light: "green",
  valid_until,
  created_at: "2026-10-18T15:00:00Z",
});
const AGORA = new Date("2026-10-19T12:00:00Z");

test("identidade (estado único) — 1. confirmada: 'Identidade confirmada · válida até 18/10/2027'", () => {
  const e = estadoIdentidadeDe(laudo("2027-10-18T15:00:00Z"), false, AGORA);
  assert.equal(e.estado, "confirmada");
  assert.equal(e.texto, "Identidade confirmada · válida até 18/10/2027");
  assert.equal(e.acao, null);
});

test("identidade (estado único) — 2. vencida: 'Identidade vencida em dd/mm/aaaa · Confirmar de novo'", () => {
  const e = estadoIdentidadeDe(laudo("2026-10-10T15:00:00Z"), true, AGORA);
  assert.equal(e.estado, "vencida");
  assert.equal(e.texto, "Identidade vencida em 10/10/2026 · Confirmar de novo");
  assert.equal(e.acao?.texto, "Confirmar de novo");
});

test("identidade (estado único) — 3. simulável: conta de teste sem laudo", () => {
  const e = estadoIdentidadeDe(null, true, AGORA);
  assert.equal(e.estado, "simulavel");
  assert.equal(e.texto, "Verificar identidade (simulado — conta de teste)");
  assert.ok(e.acao);
});

test("identidade (estado único) — 4. em breve: conta real sem laudo (e laudo simulado numa conta real não conta)", () => {
  assert.equal(estadoIdentidadeDe(null, false, AGORA).texto, "Em breve, por meio de um parceiro");
  const simuladoEmContaReal = estadoIdentidadeDe(laudo("2027-10-18T15:00:00Z", { simulado: true }), false, AGORA);
  assert.equal(simuladoEmContaReal.estado, "em_breve");
  // Na conta de teste, o mesmo laudo simulado vale.
  assert.equal(estadoIdentidadeDe(laudo("2027-10-18T15:00:00Z", { simulado: true }), true, AGORA).estado, "confirmada");
});

test("identidade — guarda: o texto 'Em breve, por meio de um parceiro' só existe na função; as telas usam a fonte única", () => {
  const raiz = fileURLToPath(new URL("../", import.meta.url));
  const achados: string[] = [];
  const andar = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const c = join(dir, n);
      if (statSync(c).isDirectory()) andar(c);
      else if (/\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n) && readFileSync(c, "utf8").includes("Em breve, por meio de um parceiro")) achados.push(c.slice(raiz.length));
    }
  };
  andar(raiz);
  assert.deepEqual(achados, ["lib/identidade/estado.ts"]);
  for (const tela of [
    "../components/account/conta-blocos.tsx",
    "../components/anuncio/etapa-identidade.tsx",
    "../components/dashboard/tenant-onboarding.tsx",
  ])
    assert.match(ler(tela), /useEstadoIdentidade\(/, tela);
  assert.match(ler("../app/(dashboard)/dashboard/verificacao/page.tsx"), /<LinhaIdentidade id=\{status\.identidade\} \/>/);
  assert.match(ler("./data/leads.ts"), /estadosIdentidade\(admin, tenantIds\)/);
  assert.match(ler("../app/api/caf/status/route.ts"), /estadoIdentidadeDe\(/);
});
