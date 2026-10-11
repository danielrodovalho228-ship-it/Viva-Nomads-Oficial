import { createClient } from "@/lib/supabase/server";
import { TIPOS_PARCEIRO } from "@/lib/parceiros/interesse";

// O layout de /admin já barra quem não é admin; a RLS barra de novo no banco (só admin lê).
export default async function AdminParceirosPage() {
  const supabase = await createClient();
  if (!supabase) return <p className="p-6">Indisponível no modo demonstração.</p>;
  const { data } = await supabase
    .from("parceiros_interesse")
    .select("id, tipo, nome, cidade, uf, whatsapp, email, site, status, criado_em")
    .order("criado_em", { ascending: false })
    .limit(200);
  const rotulo = (t: string) => TIPOS_PARCEIRO.find((x) => x.valor === t)?.rotulo ?? t;
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <h1 className="font-display text-2xl font-bold text-ink">Interesse de parceria ({data?.length ?? 0})</h1>
      {(data ?? []).length === 0 && <p className="text-ink/70">Nenhum interesse recebido ainda.</p>}
      <ul className="space-y-2">
        {(data ?? []).map((p) => (
          <li key={p.id} className="rounded-lg border border-sage-200 p-3 text-sm">
            <strong>{p.nome}</strong> · {rotulo(p.tipo)} · {p.cidade}/{p.uf} · {p.whatsapp ?? p.email} · {p.status} · {new Date(p.criado_em).toLocaleDateString("pt-BR")}
            {p.site && <> · <a href={p.site} target="_blank" rel="noopener noreferrer nofollow" className="underline">site</a></>}
          </li>
        ))}
      </ul>
    </div>
  );
}
