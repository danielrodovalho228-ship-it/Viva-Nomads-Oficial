import { Camera, KeyRound, ShieldCheck, VideoOff, type LucideIcon } from "lucide-react";
import { linhasPrivacidadePublica, type Privacidade } from "@/lib/anuncio/privacidade";

/** Ícone por tipo de linha (câmeras, acesso, senha). */
export function iconeLinhaPrivacidade(linha: string): LucideIcon {
  if (/^sem c[aâ]meras/i.test(linha)) return VideoOff;
  if (/^c[aâ]meras/i.test(linha)) return Camera;
  return KeyRound;
}

/** Bloco "Privacidade" do anúncio público: só o que o anunciante declarou. */
export function PrivacidadeAcesso({ privacidade }: { privacidade?: Privacidade }) {
  const linhas = linhasPrivacidadePublica(privacidade);
  if (linhas.length === 0) return null;
  return (
    <section className="rounded-xl border border-line bg-white p-5" data-testid="bloco-privacidade">
      <h2 className="flex items-center gap-2 font-title text-lg font-semibold text-ink">
        <ShieldCheck className="h-5 w-5 text-forest" aria-hidden /> Privacidade
      </h2>
      <ul className="mt-3 space-y-3 text-sm text-ink">
        {linhas.map((l) => {
          const Icone = iconeLinhaPrivacidade(l);
          return (
            <li key={l} className="flex items-start gap-3">
              <Icone className="mt-1 h-5 w-5 shrink-0 text-sage" strokeWidth={1.75} aria-hidden /> {l}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
