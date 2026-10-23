/*
  PAPEL-B — papel ativo com fonte única e troca explícita. Roda: node --test src/lib/papel/papel-ativo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PAPEIS,
  estadoDoPapelGravado,
  modoDoPapel,
  opcoesDeTroca,
  painelDoPapel,
  papelAtivo,
  papelDaRota,
  papelValido,
  trocaPelaArea,
  type Modo,
} from "./papel-ativo.ts";
import { AREA_MORADOR, AREA_PROPRIETARIO } from "../../config/areas-por-papel.ts";
import { menuDoPainel } from "../../config/menu-painel.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("papelAtivo: todas as combinações (admin, área da página, parceiro escolhido/aprovado, modo)", () => {
  const paginas = [undefined, "/dashboard", "/dashboard/mensagens", "/dashboard/conta", "/dashboard/imoveis", "/dashboard/locacoes", "/dashboard/parceiro", "/admin", "/admin/documentos"];
  for (const admin of [false, true])
    for (const modo of ["owner", "tenant"] as Modo[])
      for (const parceiroEscolhido of [false, true])
        for (const parceiroAprovado of [false, true])
          for (const pathname of paginas) {
            const r = papelAtivo({ admin, modo, parceiroEscolhido, parceiroAprovado, pathname });
            const caso = JSON.stringify({ admin, modo, parceiroEscolhido, parceiroAprovado, pathname });
            if (admin && (!pathname || pathname.startsWith("/admin"))) {
              assert.equal(r, null, caso); // Equipe
              continue;
            }
            const area = papelDaRota(pathname, parceiroAprovado);
            const esperado = area ?? (parceiroEscolhido && parceiroAprovado ? "parceiro" : modo === "owner" ? "proprietario" : "morador");
            assert.equal(r, esperado, caso);
            // Parceiro só com a parceria aprovada, em qualquer caso.
            if (!parceiroAprovado) assert.notEqual(r, "parceiro", caso);
          }
});

test("área da página: dono, morador e parceiro aprovado; páginas comuns não mudam o papel", () => {
  assert.equal(papelDaRota("/dashboard/imoveis/123/editar", false), "proprietario");
  assert.equal(papelDaRota("/qualificar", false), "proprietario");
  assert.equal(papelDaRota("/dashboard/favoritos", false), "morador");
  assert.equal(papelDaRota("/dashboard/parceiro/pedidos", true), "parceiro");
  assert.equal(papelDaRota("/dashboard/parceiro", false), null); // convite para quem ainda não é parceiro
  for (const comum of ["/dashboard", "/dashboard/mensagens", "/dashboard/conta", "/dashboard/conta/ajuda", "/dashboard/verificacao", "/dashboard/notificacoes"]) {
    assert.equal(papelDaRota(comum, true), null, comum);
  }
  assert.equal(papelDaRota("/dashboard/imoveisx", false), null);
});

test("as áreas são as mesmas do guarda de rota da casca (cópia da Pista A não pode divergir)", () => {
  const casca = ler("src/components/layout/dashboard-shell.tsx");
  const lista = (nome: string) => [...(casca.match(new RegExp(`const ${nome} = \\[([\\s\\S]*?)\\];`))?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(lista("OWNER_ONLY"), [...AREA_PROPRIETARIO]);
  assert.deepEqual(lista("TENANT_ONLY"), [...AREA_MORADOR]);
});

test("papel gravado → estado da sessão; troca e painel de cada papel", () => {
  assert.deepEqual(estadoDoPapelGravado("proprietario", "tenant"), { modo: "owner", parceiro: false });
  assert.deepEqual(estadoDoPapelGravado("morador", "owner"), { modo: "tenant", parceiro: false });
  assert.deepEqual(estadoDoPapelGravado("parceiro", "owner"), { modo: "owner", parceiro: true });
  assert.deepEqual(estadoDoPapelGravado(null, "owner"), { modo: "owner", parceiro: false }); // nulo = derivar como antes
  assert.deepEqual(estadoDoPapelGravado("admin", "tenant"), { modo: "tenant", parceiro: false });
  assert.equal(papelValido("parceiro"), true);
  assert.equal(papelValido("owner"), false);
  assert.equal(modoDoPapel("parceiro"), null);
  assert.equal(painelDoPapel("parceiro"), "/dashboard/parceiro");
  assert.equal(painelDoPapel("proprietario"), "/dashboard");
  // Só os papéis que a pessoa tem, menos o ativo; papel que não tem não aparece.
  assert.deepEqual(opcoesDeTroca("proprietario", ["morador", "proprietario", "parceiro"]), ["morador", "parceiro"]);
  assert.deepEqual(opcoesDeTroca("morador", ["morador"]), []);
  assert.deepEqual(opcoesDeTroca("morador", ["morador", "proprietario"]), ["proprietario"]);
  assert.deepEqual(PAPEIS, ["morador", "proprietario", "parceiro"]);
  assert.equal(trocaPelaArea("proprietario", "morador"), "proprietario");
  assert.equal(trocaPelaArea("proprietario", "proprietario"), null);
  assert.equal(trocaPelaArea(null, "morador"), null);
});

test("menu: a seção do papel ativo sobe para depois da Visão geral, sem esconder nem mostrar seção", () => {
  const ctx = { temImovel: true, admin: false, estadiaAtiva: false, parceiro: true };
  const ids = (papelAtivo?: "morador" | "proprietario" | "parceiro") => menuDoPainel({ ...ctx, papelAtivo }).map((i) => i.id);
  const base = ids();
  for (const p of ["morador", "proprietario", "parceiro"] as const) {
    const m = ids(p);
    assert.deepEqual([...m].sort(), [...base].sort(), p);
    assert.equal(m[0], "visao", p);
  }
  assert.notDeepEqual(ids("proprietario"), ids("morador"));
  // Quem não tem o papel: nada muda.
  assert.deepEqual(menuDoPainel({ ...ctx, temImovel: false, papelAtivo: "proprietario" }).map((i) => i.id), menuDoPainel({ ...ctx, temImovel: false }).map((i) => i.id));
});

test("fonte única: selo, barra, Conta, login e troca leem/gravam profiles.papel_ativo; intenção não troca depois do 1º acesso", () => {
  assert.match(ler("src/lib/nav-mobile.ts"), /return papelAtivo\(\{ admin: p\.admin, modo: p\.modo, parceiroEscolhido: !!p\.preferenciaParceiro/);
  assert.match(ler("src/lib/use-papel-barra.ts"), /useAuthStore\(\(s\) => s\.parceiroAtivo\)/);
  assert.match(ler("src/components/auth-provider.tsx"), /select\("full_name, role, preferred_mode, papel_ativo"\)/);
  const acoes = ler("src/lib/data/papel-actions.ts");
  assert.match(acoes, /update\(modo \? \{ papel_ativo: papel, preferred_mode: modo \} : \{ papel_ativo: papel \}\)/);
  assert.match(acoes, /papel === "parceiro" && !\(await ehParceiroAprovado/);
  assert.match(ler("src/lib/data/mode-actions.ts"), /papel_ativo: mode === "owner" \? "proprietario" : "morador"/);
  const intencao = ler("src/lib/data/intencao-actions.ts");
  assert.match(intencao, /const primeiroAcesso = .*intencao == null && .*papel_ativo == null/);
  assert.match(intencao, /if \(primeiroAcesso && \(modo === "owner" \|\| modo === "tenant"\)\)/);
  // A troca é a MESMA no selo e na Conta (um hook só).
  assert.match(ler("src/components/papel/troca-papel.tsx"), /useTrocaPapel\(\)/);
  assert.match(ler("src/components/account/seus-papeis.tsx"), /useTrocaPapel\(\)/);
  // A navegação coerente vale em todo o painel.
  assert.match(ler("src/app/(dashboard)/layout.tsx"), /<SincronizarPapel \/>/);
  const mig = ler("supabase/migrations/0222_papel_ativo.sql");
  assert.match(mig, /papel_ativo in \('morador', 'proprietario', 'parceiro'\)/);
  assert.match(mig, /grant update \(papel_ativo\) on public\.profiles to authenticated/);
});
