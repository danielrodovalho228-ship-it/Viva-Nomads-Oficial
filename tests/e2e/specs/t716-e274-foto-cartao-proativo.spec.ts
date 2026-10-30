import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, lerSaida, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T716 — E274 (#1610): a foto de capa do cartão do e-mail proativo volta a aparecer. O cartão leva a capa pelo
  otimizador do site (/_next/image?url=…&w=640&q=…); com q=70 o Next 16 respondia 400 (a qualidade fora de
  images.qualities) e o e-mail chegava sem foto. Agora q=75 (FOTO_CARTAO em src/lib/notifications/cartoes-email.ts).
  Disparo de verdade, como a t711: a fila emails_proativos + /api/cron/resumo-pedidos num 2º servidor do MESMO build
  (porta 3173) com um CRON_SECRET só dele.
  Por que um "Resend" próprio (porta 3174): o LAB_OUTBOX guarda o corpo SEM as tags (a <img> some) e a caixa de teste
  guarda o texto puro; só o pedido ao Resend leva o HTML inteiro. O 2º servidor aponta LAB_RESEND_URL para um servidor
  mínimo deste teste, que aceita o POST /emails como o Resend falso do laboratório e guarda o HTML.
  Por que a capa "*.supabase.co": o cartão só põe foto do Storage público de produção (https://<ref>.supabase.co/
  storage/v1/object/public/…); a foto do laboratório (http://127.0.0.1:54321) seria recusada de propósito. A capa do
  imóvel com foto aponta para um <ref>.supabase.co fictício com o MESMO caminho do arquivo que está no Storage local.
  O otimizador de produção buscaria essa URL na rede; aqui a busca usa a URL EXATA do e-mail (origem, caminho, w e q)
  trocando só o parâmetro `url` pelo endereço local do mesmo arquivo — o que se prova é que a largura e a qualidade que
  o cartão pede são aceitas pelo otimizador (200 com imagem). Controle: a mesma busca com q=70 continua 400.
    A. Imóvel com capa do Storage: o cartão tem <img> com src = /_next/image do site, url = a capa, w=640 e q dentro de
       images.qualities do next.config (sem a lista: só 75); a URL responde 200 com content-type de imagem.
    B. Imóvel sem foto nenhuma e imóvel com capa fora do Storage: o cartão sai inteiro (título, lugar, "Ver o imóvel")
       e SEM <img> (nada de imagem quebrada).
  No silêncio (22h–7h de Brasília) nada sai, de propósito: o teste pula nesse horário.
*/
const PORTA = 3173;
const PORTA_RESEND = 3174;
const BASE = `http://localhost:${PORTA}`;
const SEGREDO = `lab-t716-${Math.random().toString(36).slice(2)}`;
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: Record<string, string> = {};
const emails: Record<string, string> = {};
const caminhoCapa: Record<string, string> = {};
let servidor: ChildProcess | null = null;
let resend: Server | null = null;
const recebidos: { to: string; subject: string; html: string }[] = [];
const titulo = (k: string) => `Apto capa ${k} t716 ${sufixo}`;
const horaBRT = () => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date())) % 24;
const emSilencio = () => horaBRT() >= 22 || horaBRT() < 7;
const chave = (u: string, ev: string, ref: string) => `proativo:${ev}:${u}:${ref}`;
/** O Storage público de produção, com um <ref> fictício (só letras: o sufixo não tem dígitos). */
const capaDeProducao = (caminho: string) => `https://labt716${sufixo}.supabase.co/storage/v1/object/public/property-photos/${caminho}`;

/** As qualidades que o next.config aceita (a mesma leitura do teste de unidade do E274: sem `qualities`, só 75). */
function qualidadesAceitas(): number[] {
  const cfg = readFileSync("next.config.ts", "utf8");
  const lista = /qualities:\s*\[([^\]]*)\]/.exec(cfg);
  return lista ? lista[1].split(",").map((x) => Number(x.trim())) : [75];
}

/** Os cartões de imóvel do HTML: título → src da <img> (null quando o cartão não tem foto). */
function cartoes(html: string): { bloco: string; src: string | null }[] {
  return [...html.matchAll(/<table\b[^>]*data-cartao="imovel"[^>]*>([\s\S]*?)<\/table>/g)].map((m) => {
    const img = /<img\b[^>]*\bsrc="([^"]*)"/.exec(m[1]);
    return { bloco: m[1], src: img ? img[1].replace(/&amp;/g, "&") : null };
  });
}

async function rodar() {
  const r = await fetch(`${BASE}/api/cron/resumo-pedidos`, { headers: { authorization: `Bearer ${SEGREDO}` } });
  expect(r.status).toBe(200);
}

const doTeste = () => recebidos.filter((e) => e.to === emails.ana);

test.describe("T716 — E274: a foto de capa do cartão proativo sai pelo otimizador com q aceito (200), e o cartão sem foto não quebra", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
  test.skip(emSilencio(), "Silêncio das 22h às 7h (Brasília): nenhum proativo sai, de propósito.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    emails.dono = `dono.t716.${sufixo}@lab.vivanomads.test`;
    emails.ana = `ana.t716.${sufixo}@lab.vivanomads.test`;
    ids.dono = await criarConta({ email: emails.dono, nome: "Dora Capa", role: "owner" }, senha);
    ids.ana = await criarConta({ email: emails.ana, nome: "Ana Capa", role: "tenant" }, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.ana]);

    // Com foto: a capa (sort_order 0) no formato do Storage de produção, com o caminho do arquivo que existe no local.
    ids.comFoto = await criarImovelPronto(ids.dono, titulo("com foto"), { ativo: true });
    caminhoCapa.comFoto = `${ids.dono}/${ids.comFoto}-0.png`;
    const { error: eCapa } = await adm().from("property_photos").update({ url: capaDeProducao(caminhoCapa.comFoto) }).eq("property_id", ids.comFoto).eq("sort_order", 0);
    expect(eCapa).toBeNull();
    // Sem foto nenhuma (anúncio no ar cujas fotos saíram).
    ids.semFoto = await criarImovelPronto(ids.dono, titulo("sem foto"), { ativo: true });
    const { error: eSem } = await adm().from("property_photos").delete().eq("property_id", ids.semFoto);
    expect(eSem).toBeNull();
    // Capa fora do Storage público (o endereço https do laboratório): o cartão não a usa.
    ids.foraStorage = await criarImovelPronto(ids.dono, titulo("fora do storage"), { ativo: true });

    const { data: busca, error } = await adm().from("buscas_salvas").insert({ usuario_id: ids.ana, parametros: "local=Uberl%C3%A2ndia", resumo: "Uberlândia", alerta_ativo: true }).select("id").single();
    expect(error).toBeNull();
    ids.busca = busca!.id as string;

    // O "Resend" deste teste: aceita o POST /emails (Bearer re_…) e guarda o HTML inteiro.
    resend = createServer((req, res) => {
      let corpo = "";
      req.on("data", (c) => (corpo += c));
      req.on("end", () => {
        if (req.method !== "POST" || req.url !== "/emails" || !/^Bearer re_/.test(req.headers.authorization ?? "")) {
          res.writeHead(404, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ statusCode: 404, name: "not_found", message: "not found" }));
        }
        try {
          const b = JSON.parse(corpo) as { to: string | string[]; subject: string; html: string };
          recebidos.push({ to: Array.isArray(b.to) ? b.to[0] : b.to, subject: b.subject, html: b.html ?? "" });
        } catch {
          /* corpo inválido: só não guarda */
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ id: `lab-t716-${recebidos.length}` }));
      });
    });
    await new Promise<void>((ok) => resend!.listen(PORTA_RESEND, "127.0.0.1", ok));

    const log = createWriteStream(`${SAIDA}/t716-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, PORT: String(PORTA), LAB_RESEND_URL: `http://127.0.0.1:${PORTA_RESEND}` },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`${BASE}/api/cron/resumo-pedidos`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);

    // Os 3 imóveis na fila da busca da Ana (um e-mail só, 3 cartões: o máximo do e-mail).
    for (const im of [ids.comFoto, ids.semFoto, ids.foraStorage]) {
      const { error: eFila } = await adm()
        .from("emails_proativos")
        .insert({ usuario_id: ids.ana, evento: "saved_search_match", ref_id: im, chave: chave(ids.ana, "saved_search_match", im), extra: { busca_id: ids.busca } });
      expect(eFila).toBeNull();
    }
    await rodar();
    await expect.poll(() => doTeste().length, { timeout: 30_000, message: "o e-mail da Ana chegou ao Resend do teste" }).toBeGreaterThanOrEqual(1);
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    await new Promise<void>((ok) => (resend ? resend.close(() => ok()) : ok()));
    const todos = [ids.dono, ids.ana].filter(Boolean);
    await adm().from("emails_proativos").delete().in("usuario_id", todos);
    await adm().from("emails_teste").delete().in("usuario_id", todos);
    for (const u of todos) await adm().from("limites_uso").delete().eq("chave", `proativo-envio:${u}`);
    if (ids.ana) await adm().from("buscas_salvas").delete().eq("usuario_id", ids.ana);
    await apagarContas(todos);
  });

  test("A: o cartão com capa do Storage tem <img> pelo otimizador (w=640, q aceito) e a URL responde 200 com imagem", async () => {
    const email = doTeste().at(-1)!;
    expect(email.subject).toContain("3 imóveis combinam com a sua busca");
    const lista = cartoes(email.html);
    expect(lista, "3 cartões de imóvel no HTML").toHaveLength(3);
    const comFoto = lista.find((c) => c.bloco.includes(titulo("com foto")));
    expect(comFoto, "o cartão do imóvel com foto").toBeTruthy();
    expect(comFoto!.src, "o cartão com capa do Storage tem <img>").toBeTruthy();
    expect(comFoto!.bloco).toMatch(new RegExp(`<a href="[^"]*/imoveis/${ids.comFoto}"><img\\b`));

    const src = new URL(comFoto!.src!);
    expect(src.pathname).toBe("/_next/image");
    expect(src.searchParams.get("url")).toBe(capaDeProducao(caminhoCapa.comFoto));
    expect(src.searchParams.get("w")).toBe("640");
    const q = Number(src.searchParams.get("q"));
    expect(q).toBe(75);
    expect(qualidadesAceitas(), `q=${q} está em images.qualities do next.config`).toContain(q);

    // A URL do e-mail no otimizador do site (a mesma origem, w e q), com o mesmo arquivo servido pelo Storage local.
    const local = adm().storage.from("property-photos").getPublicUrl(caminhoCapa.comFoto).data.publicUrl;
    const pedir = (qualidade: string) => {
      const u = new URL(src.toString());
      u.searchParams.set("url", local);
      u.searchParams.set("q", qualidade);
      return fetch(u, { headers: { accept: "image/webp,image/*" } });
    };
    const ok = await pedir(String(q));
    expect(ok.status, "a foto do cartão no otimizador").toBe(200);
    expect(ok.headers.get("content-type") ?? "").toMatch(/^image\//);
    expect((await ok.arrayBuffer()).byteLength).toBeGreaterThan(100);
    // Controle (o defeito do E274): a qualidade antiga, fora da lista, continua recusada.
    const antiga = await pedir("70");
    expect(antiga.status, "q=70 fora de images.qualities").toBe(400);

    // O mesmo envio no LAB_OUTBOX (sem as tags): o cartão com foto leva ao anúncio.
    const saida = (await lerSaida()).filter((l) => l.servico === "email" && l.para === emails.ana).map((l) => String(l.corpo ?? ""));
    expect(saida.some((c) => c.includes(titulo("com foto")) && c.includes(`/imoveis/${ids.comFoto}`))).toBe(true);
  });

  test("B: imóvel sem foto e imóvel com capa fora do Storage — o cartão sai inteiro e sem <img> (nada quebrado)", async () => {
    const email = doTeste().at(-1)!;
    const lista = cartoes(email.html);
    for (const [k, id] of [["sem foto", ids.semFoto], ["fora do storage", ids.foraStorage]] as const) {
      const c = lista.find((x) => x.bloco.includes(titulo(k)));
      expect(c, `o cartão do imóvel ${k}`).toBeTruthy();
      expect(c!.src, `cartão ${k}: sem <img>`).toBeNull();
      expect(c!.bloco).not.toMatch(/<img\b/);
      expect(c!.bloco).toContain("Centro, Uberlândia - MG");
      expect(c!.bloco).toMatch(new RegExp(`<a href="[^"]*/imoveis/${id}"[^>]*>Ver o imóvel</a>`));
    }
    // Nenhuma <img> do e-mail aponta para o otimizador sem url (o "quebrado" de uma capa vazia).
    for (const m of email.html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/g)) {
      expect(m[1]).not.toBe("");
      expect(m[1]).not.toMatch(/_next\/image\?url=(&|$)/);
    }
  });
});
