"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Clock, Eye } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { EspelhoPerfil } from "@/components/account/espelho-perfil";
import { meuPerfilPublico, type MeuPerfilPublico } from "@/lib/data/papeis-actions";
import { desdeLabel } from "@/lib/perfil/perfil-publico";
import { TITULO_ESPELHO, TITULO_ESPELHO_DONO, verComo } from "@/lib/perfil/espelho";

type Papel = "morador" | "proprietario";

/**
 * E55 — o espelho acompanha o PAPEL EM USO (a mesma fonte da barra: o modo da conta). Morador: o cartão que o
 * proprietário vê quando ele pede para morar. Proprietário: a faixa do proprietário da página do imóvel (foto, nome,
 * "Na Viva desde", tempo de resposta e só os selos que são fato). Quem tem os dois papéis vê o do papel em uso e um link
 * "Ver como [o outro papel]".
 */
export function EspelhoPorPapel(p: { papel: Papel; foto: string | null; nome: string; emailConfirmado: boolean; bio: string }) {
  const [publico, setPublico] = useState<MeuPerfilPublico | null>(null);
  const [visto, setVisto] = useState<Papel | null>(null);
  useEffect(() => {
    let vivo = true;
    meuPerfilPublico()
      .then((r) => vivo && setPublico(r))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  const ehDono = !!publico?.ehDono;
  // Sem o papel de proprietário, só existe o espelho de morador.
  const papel: Papel = !ehDono ? "morador" : (visto ?? p.papel);
  const outro: Papel = papel === "morador" ? "proprietario" : "morador";
  return (
    <div className="space-y-2" data-testid="espelho-papel" data-papel={papel}>
      {papel === "proprietario" && publico ? (
        <EspelhoDono publico={publico} foto={p.foto ?? publico.fotoUrl} />
      ) : (
        <EspelhoPerfil foto={p.foto} nome={p.nome} emailConfirmado={p.emailConfirmado} bio={p.bio} titulo={TITULO_ESPELHO} />
      )}
      {ehDono && (
        <p className="text-center">
          <button type="button" onClick={() => setVisto(outro)} className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4 hover:text-forest" data-testid="espelho-ver-como">
            {verComo(outro)}
          </button>
        </p>
      )}
    </div>
  );
}

/** A faixa do proprietário como o morador a vê na página do imóvel. */
function EspelhoDono({ publico, foto }: { publico: MeuPerfilPublico; foto: string | null }) {
  const desde = desdeLabel(publico.desde);
  return (
    <section className="scroll-mt-24 rounded-xl bg-white p-4 sm:p-6 xl:p-4 lg:sticky lg:top-24" aria-labelledby="espelho-titulo" data-testid="espelho-perfil">
      <h2 id="espelho-titulo" className="flex justify-start lg:justify-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-forest px-3 py-2 text-sm font-semibold text-white xl:text-xs" data-testid="espelho-titulo">
          <Eye className="h-4 w-4 shrink-0" aria-hidden /> {TITULO_ESPELHO_DONO}
        </span>
      </h2>
      <div className="mt-4 flex items-start gap-4 lg:flex-col lg:items-center lg:text-center" data-testid="espelho-dono">
        <Avatar name={publico.nome} size={64} photoUrl={foto ?? undefined} />
        <div className="min-w-0 flex-1 lg:w-full">
          <p className="font-title text-xl font-semibold text-ink" data-testid="espelho-nome">
            {publico.nome}
          </p>
          {desde && (
            <p className="mt-1 text-sm text-muted" data-testid="espelho-desde">
              {desde}
            </p>
          )}
          {publico.resposta && (
            <p className="mt-1 flex items-center gap-1 text-sm text-muted lg:justify-center" data-testid="espelho-resposta">
              <Clock className="h-4 w-4" aria-hidden /> Responde {publico.resposta.taxa}% das conversas, {publico.resposta.tempo}
            </p>
          )}
          {publico.selos.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-2 lg:justify-center" data-testid="espelho-selos">
              {publico.selos.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full bg-forest px-3 py-1 text-xs font-semibold text-white">
                  <BadgeCheck className="h-4 w-4" aria-hidden /> {s}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
