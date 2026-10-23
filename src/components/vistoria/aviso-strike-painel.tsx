import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { vistoriaAtiva } from "@/lib/vistoria/chave";
import { avisoStrike } from "@/lib/vistoria/telas-laudo";

/**
 * Prompt 62-A, Parte 2, item 12: no 3º passo da escada, o aviso abre o painel do proprietário com a lista dos anúncios
 * que estão fora da busca. A fonte é o bloqueio aberto "strike_3" que o servidor (62-B2) grava; o dono lê os próprios
 * bloqueios pela RLS. Com a chave desligada, não aparece nada.
 */
export async function AvisoStrikePainel() {
  if (!(await vistoriaAtiva())) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("vistoria_bloqueios")
    .select("property_id, properties(title)")
    .eq("owner_id", user.id)
    .eq("motivo", "strike_3")
    .is("resolvido_em", null);
  const fora = (data ?? []) as unknown as { property_id: string; properties: { title: string | null } | null }[];
  if (!fora.length) return null;
  const aviso = avisoStrike(3)!;
  return (
    <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm" data-testid="aviso-strike-painel" aria-labelledby="aviso-strike-titulo">
      <h2 id="aviso-strike-titulo" className="font-semibold text-ink">{aviso.titulo}</h2>
      <p className="mt-1 text-ink">{aviso.texto}</p>
      <ul className="mt-2 grid gap-1" data-testid="aviso-strike-lista">
        {fora.map((b) => (
          <li key={b.property_id}>
            <Link href={`/dashboard/imoveis/${b.property_id}/nivel#rota-avaliacao`} className="font-semibold text-forest underline underline-offset-2" data-testid="aviso-strike-imovel">
              {b.properties?.title ?? "Anúncio"}
            </Link>
            <span className="text-muted"> · fora da busca até uma nova avaliação aprovada</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
