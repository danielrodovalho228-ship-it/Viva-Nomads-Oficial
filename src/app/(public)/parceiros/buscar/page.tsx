import type { Metadata } from "next";
import { Search } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { trilha } from "@/lib/seo/estruturados";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { buttonClasses } from "@/components/ui/button";
import { CartaoParceiro } from "@/components/parceiros/cartao-parceiro";
import { BuscaVazia } from "@/components/parceiros/busca-vazia";
import { buscarParceiros, lerParceiroGeralServidor } from "@/lib/data/parceiros-publico";
import { ROTULO_FILTRO_NOTA } from "@/lib/parceiros/fiscal";
import { CATEGORIAS_CATALOGO, categoriaValida, rotuloCategoria } from "@/lib/parceiros/regras";
import { formatarCep } from "@/lib/fotografos/regras";
import { MUNICIPIOS } from "@/lib/municipios";

export const metadata: Metadata = {
  alternates: { canonical: "/parceiros/buscar" },
  title: "Encontre um parceiro: fotografia, mudança, limpeza e mais",
  description: "Parceiros da Viva Nomads para imóveis mobiliados: fotografia, mudança, limpeza, lavanderia, montagem e manutenção. Busque pela cidade ou CEP.",
};

const UFS = Object.keys(MUNICIPIOS).sort();
const campo = "mt-1 w-full rounded-lg border border-sage-200 bg-white px-3 py-2 text-base text-ink";

export default async function BuscarParceirosPage({ searchParams }: { searchParams: Promise<{ categoria?: string; cidade?: string; uf?: string; cep?: string; avisar?: string; imovel?: string; descricao?: string; nota?: string }> }) {
  const sp = await searchParams;
  const categoria = sp.categoria && categoriaValida(sp.categoria) ? sp.categoria : "";
  const soNota = sp.nota === "1";
  const r = await buscarParceiros({ categoria, cidade: sp.cidade, uf: sp.uf, cep: sp.cep, soNota });
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const geral = r.lista.length ? null : await lerParceiroGeralServidor();
  // Vindo da página da estadia (Prompt 41, "Pedir limpeza"/"Pedir manutenção"): o imóvel e a categoria seguem até o
  // "Solicitar orçamento" do parceiro (o mesmo caminho do /parceiros/fotografos).
  const imovel = sp.imovel && /^[0-9a-f-]{36}$/i.test(sp.imovel) ? sp.imovel : "";
  // Prompt 59: manutenção fora do prazo leva também a descrição da ordem para a folha do pedido.
  const descricao = (sp.descricao ?? "").trim().slice(0, 500);
  const qImovel = imovel ? new URLSearchParams({ imovel, ...(categoria ? { categoria } : {}) }) : null;
  if (qImovel && descricao) qImovel.set("descricao", descricao);
  const consultaDoImovel = qImovel?.toString();
  const qs = new URLSearchParams({ ...(categoria ? { categoria } : {}), ...(r.cidade ? { cidade: r.cidade } : {}), ...(r.uf ? { uf: r.uf } : {}) }).toString();

  return (
    <div className="container-page py-8">
      <JsonLd dados={trilha(SITE_URL, [{ nome: "Parceiros", caminho: "/parceiros" }, { nome: "Buscar", caminho: "/parceiros/buscar" }])} />
      <h1 className="font-title text-2xl font-semibold text-ink sm:text-[28px]">Encontre um parceiro{categoria ? `: ${rotuloCategoria(categoria).toLowerCase()}` : ""}</h1>
      <p className="mt-2 max-w-2xl text-muted">Profissionais aprovados pela Viva. Você combina e agenda tudo pelas mensagens da Viva; contato e endereço só depois do aceite.</p>

      <form method="get" className="mt-6 grid gap-3 rounded-xl border border-sage-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.2fr_0.6fr_1fr_auto] lg:items-end" data-testid="busca-parceiros-filtros">
        {imovel && <input type="hidden" name="imovel" value={imovel} />}
        <div>
          <label htmlFor="bp-categoria" className="block text-sm font-medium text-ink">Categoria</label>
          <select id="bp-categoria" name="categoria" defaultValue={categoria} className={campo}>
            <option value="">Todas</option>
            {CATEGORIAS_CATALOGO.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="bp-cidade" className="block text-sm font-medium text-ink">Cidade</label>
          <input id="bp-cidade" name="cidade" autoComplete="address-level2" defaultValue={r.cidade} placeholder="Uberlândia" className={campo} />
        </div>
        <div>
          <label htmlFor="bp-uf" className="block text-sm font-medium text-ink">UF</label>
          <select id="bp-uf" name="uf" defaultValue={r.uf} className={campo}>
            <option value="">—</option>
            {UFS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="bp-cep" className="block text-sm font-medium text-ink">ou CEP</label>
          <input id="bp-cep" name="cep" inputMode="numeric" autoComplete="postal-code" defaultValue={r.cep ? formatarCep(r.cep) : ""} placeholder="00000-000" className={campo} />
        </div>
        {/* FISCAL-PARCEIRO-B: só parceiros PJ que declararam emitir nota de serviço (com a contagem da busca). */}
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink sm:col-span-2 lg:col-span-5 lg:order-last" data-testid="busca-parceiros-nota" data-qtd={r.comNota}>
          <input type="checkbox" name="nota" value="1" defaultChecked={soNota} data-testid="busca-parceiros-nota-check" />
          {ROTULO_FILTRO_NOTA} ({r.comNota})
        </label>
        <button type="submit" className={buttonClasses({ size: "md", className: "w-full sm:col-span-2 lg:col-span-1 lg:w-auto" })} data-testid="busca-parceiros-buscar">
          <Search className="h-4 w-4" aria-hidden /> Buscar
        </button>
      </form>

      {r.cepNaoEncontrado && (
        <p className="mt-4 text-ink" data-testid="busca-parceiros-cep">
          Não encontramos esse CEP. Confira os números ou busque pela cidade.
        </p>
      )}

      <section aria-live="polite" className="mt-8" data-testid="busca-parceiros-resultado" data-total={r.lista.length}>
        {r.lista.length > 0 ? (
          <>
            <p className="text-sm text-muted">
              {r.lista.length} {r.lista.length === 1 ? "parceiro" : "parceiros"}
              {r.cidade ? ` em ${r.cidade}` : ""}
            </p>
            <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {r.lista.map((p) => (
                <CartaoParceiro key={p.id} p={p} consulta={consultaDoImovel} />
              ))}
            </ul>
          </>
        ) : (
          <BuscaVazia
            categoria={categoria}
            cidade={r.cidade}
            uf={r.uf}
            logado={!!user}
            autoAvisar={!!user && sp.avisar === "1"}
            voltarPara={`/parceiros/buscar${qs ? `?${qs}` : ""}`}
            geral={geral!}
          />
        )}
      </section>

    </div>
  );
}
