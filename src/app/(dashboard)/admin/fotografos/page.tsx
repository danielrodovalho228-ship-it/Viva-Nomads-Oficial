import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/utils";
import { TAXA_PARCERIA_PADRAO } from "@/lib/fotografos/regras";
import { AprovarBotao, CadastroForm, TaxaForm } from "./forms";

// O layout de /admin já barra quem não é admin; a RLS barra de novo no banco.
export default async function AdminFotografosPage() {
  const supabase = await createClient();
  if (!supabase) return <p className="p-6">Indisponível no modo demonstração.</p>;

  const [{ data: fotografos }, { data: pedidos }, { data: cfg }] = await Promise.all([
    supabase.from("fotografos").select("id, nome_comercial, cidades, pacote_preco, nota_media, avaliacoes_qtd, aprovado").order("criado_em", { ascending: false }).limit(200),
    supabase.from("fotografo_pedidos").select("id, cidade, uf, data_sugerida, status, taxa_paga_em, criado_em, fotografos(nome_comercial)").order("criado_em", { ascending: false }).limit(100),
    supabase.from("config_parceria").select("valor").eq("chave", "taxa_parceria_fotografo").maybeSingle(),
  ]);
  const taxa = cfg?.valor != null ? Number(cfg.valor) : TAXA_PARCERIA_PADRAO;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6">
      <h1 className="font-display text-2xl font-bold text-ink">Fotógrafos parceiros</h1>
      <section aria-labelledby="h-taxa"><h2 id="h-taxa" className="mb-2 font-semibold">Taxa de parceria</h2><TaxaForm taxa={taxa} /></section>
      <section aria-labelledby="h-cad"><h2 id="h-cad" className="mb-2 font-semibold">Cadastrar fotógrafo</h2><CadastroForm /></section>
      <section aria-labelledby="h-lista">
        <h2 id="h-lista" className="mb-2 font-semibold">Fotógrafos ({fotografos?.length ?? 0})</h2>
        <ul className="space-y-2">
          {(fotografos ?? []).map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sage-200 p-3 text-sm">
              <span><strong>{f.nome_comercial}</strong> — {(f.cidades as string[]).join(", ")} — {formatBRL(Number(f.pacote_preco))} — {f.nota_media ? `nota ${Number(f.nota_media).toFixed(1)} (${f.avaliacoes_qtd})` : "sem notas"} — {f.aprovado ? "aprovado" : "pendente"}</span>
              <AprovarBotao id={f.id} aprovado={f.aprovado} />
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="h-ped">
        <h2 id="h-ped" className="mb-2 font-semibold">Pedidos ({pedidos?.length ?? 0})</h2>
        <ul className="space-y-2">
          {(pedidos ?? []).map((p) => {
            const f = p.fotografos as unknown as { nome_comercial: string } | null;
            return (
              <li key={p.id} className="rounded-lg border border-sage-200 p-3 text-sm">
                {f?.nome_comercial ?? "—"} · {p.cidade}/{p.uf} · {p.data_sugerida} · {p.status} · {p.taxa_paga_em ? "taxa paga" : "taxa pendente"}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
