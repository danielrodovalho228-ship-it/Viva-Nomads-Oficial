import type { Metadata } from "next";
import { Camera, MapPin, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import { cidadeDoCep, filtrarPorCidade, formatarCep, MAX_DIAS_ANTECEDENCIA, normalizarCep, portfolioSeguro, type FotografoPublico } from "@/lib/fotografos/regras";
import { PedidoForm } from "./pedido-form";

export const metadata: Metadata = {
  alternates: { canonical: "/parceiros/fotografos" },
  title: "Fotógrafos parceiros para imóveis mobiliados",
  description: "Encontre um fotógrafo parceiro da Viva Nomads na cidade do seu imóvel mobiliado. Fotos que vão direto para o anúncio.",
};

const COLUNAS = "id, nome_comercial, cidades, portfolio_url, pacote_fotos, pacote_prazo_dias, pacote_preco, nota_media, avaliacoes_qtd";

export default async function FotografosPage({ searchParams }: { searchParams: Promise<{ cep?: string; cidade?: string; uf?: string }> }) {
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
  const doCep = cepBusca ? await cidadeDoCep(cepBusca) : null;
  const cidade = (doCep?.cidade ?? sp.cidade ?? "").toString().trim().slice(0, 80);
  const uf = (doCep?.uf ?? sp.uf ?? "").toString().trim().toUpperCase().slice(0, 2);
  const buscou = !!(cidade || cepBusca);

  let fotografos: FotografoPublico[] = [];
  if (supabase && cidade) {
    const { data } = await supabase.from("fotografos").select(COLUNAS).eq("aprovado", true).order("nota_media", { ascending: false, nullsFirst: false }).limit(200);
    fotografos = filtrarPorCidade((data ?? []) as FotografoPublico[], cidade);
  }

  const hoje = new Date();
  const minData = hoje.toISOString().slice(0, 10);
  const maxData = new Date(hoje.getTime() + MAX_DIAS_ANTECEDENCIA * 86400000).toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Fotógrafos parceiros</h1>
      <p className="mt-2 text-ink/70">Fotos profissionais do seu imóvel mobiliado, feitas por fotógrafos aprovados pela Viva. As fotos vão direto para o seu anúncio.</p>

      <form method="get" className="mt-6 grid gap-3 rounded-xl border border-sage-200 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="cep" className="block text-sm font-medium text-ink">CEP do imóvel</label>
          <input id="cep" name="cep" inputMode="numeric" autoComplete="postal-code" defaultValue={cepBusca ? formatarCep(cepBusca) : ""} placeholder="00000-000" className="mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base" />
        </div>
        <div>
          <label htmlFor="cidade" className="block text-sm font-medium text-ink">ou cidade</label>
          <input id="cidade" name="cidade" defaultValue={cidade} placeholder="Uberlândia" className="mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base" />
        </div>
        <button type="submit" className="rounded-lg bg-night px-5 py-2.5 text-base font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Buscar</button>
      </form>

      {buscou && !cidade && <p className="mt-6 text-ink/70">Não encontramos esse CEP. Confira os números ou digite a cidade.</p>}

      {cidade && (
        <section aria-live="polite" className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink"><MapPin className="size-5" aria-hidden /> Fotógrafos em {cidade}</h2>
          {fotografos.length === 0 ? (
            <p className="mt-3 text-ink/70">Ainda não temos fotógrafo parceiro nesta cidade. Você pode seguir com as suas próprias fotos: o anúncio pode ser publicado normalmente.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {fotografos.map((f) => {
                const link = portfolioSeguro(f.portfolio_url);
                return (
                  <li key={f.id} className="rounded-xl border border-sage-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="flex items-center gap-2 font-semibold text-ink"><Camera className="size-5 shrink-0" aria-hidden /> {f.nome_comercial}</h3>
                      <p className="flex shrink-0 items-center gap-1 text-sm text-ink/70">
                        <Star className="size-4" aria-hidden />
                        {f.nota_media ? `${Number(f.nota_media).toFixed(1)} (${f.avaliacoes_qtd})` : "Sem avaliações ainda"}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-ink/70">Atende: {f.cidades.join(", ")}</p>
                    <p className="mt-2 text-sm text-ink">Pacote <strong>Foto Viva</strong>: {f.pacote_fotos} fotos em até {f.pacote_prazo_dias} {f.pacote_prazo_dias === 1 ? "dia" : "dias"} — <strong>{formatBRL(Number(f.pacote_preco))}</strong></p>
                    {link && <p className="mt-1 text-sm"><a href={link} target="_blank" rel="noopener noreferrer nofollow" className="underline">Ver portfólio</a></p>}
                    {!user ? (
                      <div className="mt-3"><ButtonLink href={`/auth?redirect=${encodeURIComponent(`/parceiros/fotografos?cidade=${encodeURIComponent(cidade)}&uf=${uf}${cepBusca ? `&cep=${cepBusca}` : ""}`)}`}>Entrar para pedir</ButtonLink></div>
                    ) : cepBusca && uf ? (
                      <PedidoForm fotografoId={f.id} cep={cepBusca} cidade={cidade} uf={uf} minData={minData} maxData={maxData} />
                    ) : (
                      <p className="mt-3 text-sm text-ink/70">Para pedir, busque pelo CEP do imóvel.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      <p className="mt-8 text-xs text-ink/60">O pagamento do serviço é combinado entre você e o fotógrafo; a Viva não recebe esse dinheiro. Seu contato e o endereço só são liberados depois que o fotógrafo aceitar o pedido.</p>
    </div>
  );
}
