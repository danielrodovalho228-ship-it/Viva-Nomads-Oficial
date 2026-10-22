import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { trilha } from "@/lib/seo/estruturados";
import { SITE_URL } from "@/lib/site";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { formatarCep, normalizarCep } from "@/lib/fotografos/regras";
import { PAGAMENTO_PARCEIROS_ATIVO } from "@/lib/flags";
import { AvisoFotografo } from "./aviso-fotografo";
import { TITULO_SEM_FOTOGRAFO } from "@/lib/fotografos/aviso";
import { buscarParceiros, lerParceiroGeralServidor } from "@/lib/data/parceiros-publico";
import { CartaoParceiro } from "@/components/parceiros/cartao-parceiro";
import { RegrasParceiros } from "@/components/parceiros/regras-parceiros";
import { CONTATO_APOS_ACEITE, mostrarParceiroGeral } from "@/lib/parceiros/regras";

/*
  Prompt 31a, item 6: /parceiros/fotografos é a busca de parceiros filtrada em fotografia (lê a view pública
  parceiros_publicos). O formulário de pedido antigo saiu (a contratação vem no 31b); o avise-me fica.
*/

export const metadata: Metadata = {
  alternates: { canonical: "/parceiros/fotografos" },
  title: "Fotógrafos parceiros para imóveis mobiliados",
  description: "Encontre um fotógrafo parceiro da Viva Nomads na cidade do seu imóvel mobiliado. Fotos que vão direto para o anúncio.",
};

export default async function FotografosPage({ searchParams }: { searchParams: Promise<{ cep?: string; cidade?: string; uf?: string; avisar?: string; imovel?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();

  // CEP do rascunho do dono (pré-preenche a busca quando ele chega pelo cadastro do imóvel).
  let user: { id: string } | null = null;
  let cepRascunho = "";
  if (supabase) {
    user = (await supabase.auth.getUser()).data.user;
    if (user && !sp.cep && !sp.cidade) {
      const { data: rasc } = await supabase.from("properties").select("id").eq("owner_id", user.id).eq("status", "draft").order("created_at", { ascending: false }).limit(1).maybeSingle();
      // draft_data é coluna sensível: o dono lê pela RPC (que confere o dono).
      const { data: priv } = rasc ? await supabase.rpc("property_private_details", { prop_id: rasc.id }) : { data: null };
      const linha = Array.isArray(priv) ? priv[0] : priv;
      cepRascunho = normalizarCep((linha?.draft_data as { cep?: unknown } | null)?.cep) ?? "";
    }
  }

  const cepBusca = normalizarCep(sp.cep) ?? cepRascunho;
  const r = await buscarParceiros({ categoria: "fotografia", cidade: sp.cidade, uf: sp.uf, cep: cepBusca });
  // Vindo do passo de fotos do cadastro (Prompt 31b): o imóvel segue até o "Solicitar orçamento" do fotógrafo.
  const consultaDoImovel = sp.imovel && /^[0-9a-f-]{36}$/i.test(sp.imovel) ? new URLSearchParams({ imovel: sp.imovel, cadastro: "1" }).toString() : undefined;
  const { cidade, uf } = r;
  const buscou = !!(cidade || cepBusca);
  const fotografos = cidade ? r.lista : [];
  const geral = cidade && !fotografos.length ? await lerParceiroGeralServidor() : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <JsonLd dados={trilha(SITE_URL, [{ nome: "Fotógrafos parceiros", caminho: "/parceiros/fotografos" }])} />
      <h1 className="font-display text-2xl font-semibold text-ink sm:text-[28px]">Fotógrafos parceiros</h1>
      <p className="mt-2 text-ink/70">Fotos profissionais do seu imóvel mobiliado, feitas por fotógrafos aprovados pela Viva. As fotos vão direto para o seu anúncio.</p>
      <p className="mt-2 text-sm font-medium text-ink" data-testid="pedir-gratis">Pedir é grátis: a Viva não cobra nada de você pelo pedido.</p>

      <form method="get" className="mt-6 grid gap-3 rounded-xl border border-sage-200 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="cep" className="block text-sm font-medium text-ink">CEP do imóvel</label>
          <input id="cep" name="cep" inputMode="numeric" autoComplete="postal-code" defaultValue={cepBusca ? formatarCep(cepBusca) : ""} placeholder="00000-000" className="mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base" />
        </div>
        <div>
          <label htmlFor="cidade" className="block text-sm font-medium text-ink">ou cidade</label>
          <input id="cidade" name="cidade" autoComplete="address-level2" defaultValue={cidade} placeholder="Uberlândia" className="mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base" />
        </div>
        <button type="submit" className={buttonClasses({ size: "md" })}>Buscar</button>
      </form>

      {buscou && !cidade && (
        <p className="mt-6 text-ink/70" data-testid="fotografos-cep-nao-encontrado">
          Não encontramos esse CEP. Confira os números ou digite só a cidade (ex.: Uberlândia) — se ainda não houver
          fotógrafo nela, você pode pedir para ser avisado.
        </p>
      )}

      {cidade && (
        <section aria-live="polite" className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink"><MapPin className="size-5" aria-hidden /> Fotógrafos em {cidade}</h2>
          {fotografos.length === 0 ? (
            <div data-testid="fotografos-vazio">
              <p className="mt-3 text-ink">{TITULO_SEM_FOTOGRAFO(cidade)}</p>
              <AvisoFotografo
                cidade={cidade}
                uf={uf}
                logado={!!user}
                autoAvisar={!!user && sp.avisar === "1"}
                voltarPara={`/parceiros/fotografos?cidade=${encodeURIComponent(cidade)}${uf ? `&uf=${uf}` : ""}${cepBusca ? `&cep=${cepBusca}` : ""}`}
              />
              {geral && mostrarParceiroGeral(geral, 0) && (
                <div className="mt-4 rounded-xl border border-sage-200 bg-sage-50 p-4" data-testid="parceiro-geral">
                  <p className="text-xs font-semibold text-forest">Parceiro geral da Viva</p>
                  <p className="mt-1 font-title text-lg font-semibold text-ink">{geral.nome}</p>
                  {geral.descricao && <p className="mt-1 text-sm text-ink">{geral.descricao}</p>}
                </div>
              )}
            </div>
          ) : (
            <ul className="mt-4 grid gap-4" data-testid="fotografos-lista">
              {fotografos.map((p) => (
                <CartaoParceiro key={p.id} p={p} consulta={consultaDoImovel} />
              ))}
            </ul>
          )}
        </section>
      )}
      <section className="mt-8" aria-labelledby="h-e-fotografo">
        <h2 id="h-e-fotografo" className="font-display text-xl font-semibold text-ink">É fotógrafo?</h2>
        <p className="mb-3 mt-1 text-sm text-ink/70">Como funciona a parceria:</p>
        <RegrasParceiros pagamentoAtivo={PAGAMENTO_PARCEIROS_ATIVO} />
      </section>
      <div className="mt-4"><ButtonLink href="/parceiros?categoria=fotografia#quero-ser-parceiro" variant="outline" className="w-full min-h-11 sm:w-auto">É fotógrafo? Seja parceiro</ButtonLink></div>
      <p className="mt-4 text-xs text-ink/60" data-testid="fotografos-contato-aceite">{CONTATO_APOS_ACEITE}</p>
    </div>
  );
}
