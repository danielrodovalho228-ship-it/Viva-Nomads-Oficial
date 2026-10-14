import { ShieldCheck } from "lucide-react";
import { linhasPrivacidadePublica, type Privacidade } from "@/lib/anuncio/privacidade";

/** Bloco "Privacidade" do anúncio público: só o que o anunciante declarou. */
export function PrivacidadeAcesso({ privacidade }: { privacidade?: Privacidade }) {
  const linhas = linhasPrivacidadePublica(privacidade);
  if (linhas.length === 0) return null;
  return (
    <section className="rounded-2xl border border-line bg-white p-5" data-testid="bloco-privacidade">
      <h2 className="flex items-center gap-2 font-title text-lg font-bold text-ink">
        <ShieldCheck className="h-5 w-5 text-forest" aria-hidden /> Privacidade
      </h2>
      <ul className="mt-3 space-y-1.5 text-sm text-ink">
        {linhas.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </section>
  );
}
