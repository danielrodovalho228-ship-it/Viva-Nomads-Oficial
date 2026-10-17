import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Building2, Clock, Handshake, Languages, MapPin, MessageSquare, Star, UserRound } from "lucide-react";
import type { Property } from "@/lib/types";
import type { PerfilProprietario } from "@/lib/data/perfil-proprietario";
import { iniciais, corAvatar } from "@/lib/avatar";
import { isExemplo } from "@/lib/demo-listing";
import { desdeLabel } from "@/lib/perfil/perfil-publico";
import { donoVerificado } from "@/lib/anuncio/dono-verificado";
import { SeloDonoVerificado } from "@/components/property/selo-dono-verificado";
import { buttonClasses } from "@/components/ui/button";

function AvatarDono({ nome, foto }: { nome: string; foto: string | null | undefined }) {
  return foto ? (
    <Image src={foto} alt={`Foto de ${nome}`} width={64} height={64} className="h-16 w-16 shrink-0 rounded-full object-cover" />
  ) : (
    <div
      className="grid h-16 w-16 shrink-0 place-items-center rounded-full font-title text-xl font-bold text-white"
      style={{ backgroundColor: corAvatar(nome) }}
      aria-hidden
    >
      {iniciais(nome)}
    </div>
  );
}

/**
 * "Sobre o proprietário" (prompt 6): nome curto, cidade, desde, contagens, avaliações, resposta no chat,
 * idiomas, bio e selos REAIS. Sem telefone nem e-mail: o contato é "Enviar mensagem" (chat da Viva).
 * Anúncio de exemplo: "Proprietário (exemplo)" e nenhum número.
 */
export function OwnerCard({
  property,
  proprietario,
  onMensagem,
}: {
  property: Property;
  proprietario?: PerfilProprietario | null;
  onMensagem?: () => void;
}) {
  const exemplo = isExemplo(property);

  if (exemplo) {
    const nome = property.ownerName || "Proprietário (exemplo)";
    return (
      <section aria-labelledby="proprietario-title" data-testid="sobre-proprietario">
        <h2 id="proprietario-title" className="font-title text-2xl font-bold text-ink">
          Sobre o proprietário
        </h2>
        <div className="mt-5 flex items-start gap-4 rounded-2xl border border-sage-200 p-5">
          <AvatarDono nome={nome} foto={null} />
          <div className="min-w-0">
            <p className="font-title font-bold text-ink">{nome}</p>
            <p className="mt-1 text-sm text-muted" data-testid="proprietario-exemplo">
              Anúncio de demonstração: os dados do proprietário aparecem nos anúncios reais.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const owner = property.owner;
  const nome = proprietario?.nome ?? owner?.name ?? property.ownerName;
  if (!nome) return null;
  const foto = proprietario ? proprietario.fotoUrl : owner?.avatarUrl;
  const desde = desdeLabel(proprietario?.desde ?? owner?.memberSince);

  const fatos: { icone: typeof Clock; texto: string; testid?: string }[] = [];
  if (proprietario?.cidade) fatos.push({ icone: MapPin, texto: proprietario.cidade });
  if (desde) fatos.push({ icone: Handshake, texto: desde });
  if (proprietario) {
    fatos.push({ icone: Building2, texto: `${proprietario.imoveisAtivos} ${proprietario.imoveisAtivos === 1 ? "imóvel" : "imóveis"} na Viva` });
    fatos.push({ icone: UserRound, texto: `${proprietario.estadiasConcluidas} ${proprietario.estadiasConcluidas === 1 ? "estadia concluída" : "estadias concluídas"}` });
    fatos.push(
      proprietario.resposta
        ? { icone: Clock, texto: `Responde ${proprietario.resposta.taxa}% das conversas, ${proprietario.resposta.tempo}`, testid: "proprietario-resposta" }
        : { icone: Clock, texto: "Novo na Viva", testid: "proprietario-resposta" },
    );
    if (proprietario.idiomas.length > 0) fatos.push({ icone: Languages, texto: `Fala ${proprietario.idiomas.join(", ")}` });
  }

  return (
    <section aria-labelledby="proprietario-title" data-testid="sobre-proprietario">
      <h2 id="proprietario-title" className="font-title text-2xl font-bold text-ink">
        Sobre o proprietário
      </h2>

      <div className="mt-5 rounded-2xl border border-sage-200 p-5">
        <div className="flex items-start gap-4">
          <AvatarDono nome={nome} foto={foto} />
          <div className="min-w-0">
            <p className="font-title text-lg font-bold text-ink" data-testid="proprietario-nome">{nome}</p>
            {/* Selos só com verificação REAL registrada (nunca por padrão, nunca em exemplo). */}
            <div className="mt-1 flex flex-wrap items-center gap-2" data-testid="proprietario-selos">
              {donoVerificado(property) && <SeloDonoVerificado />}
              {proprietario?.selos.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-medium text-forest">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> {s}
                </span>
              ))}
            </div>
            {proprietario && proprietario.reputacao.n > 0 && (
              <Link
                href={`/proprietario/${proprietario.id}#avaliacoes`}
                className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-ink hover:text-forest"
                data-testid="proprietario-reputacao"
              >
                <Star className="h-4 w-4 fill-champagne text-champagne" aria-hidden />
                {proprietario.reputacao.media.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} ·{" "}
                {proprietario.reputacao.n} {proprietario.reputacao.n === 1 ? "avaliação" : "avaliações"}
              </Link>
            )}
          </div>
        </div>

        {fatos.length > 0 && (
          <ul className="mt-4 grid gap-2 text-sm text-ink sm:grid-cols-2">
            {fatos.map((f) => (
              <li key={f.texto} className="flex items-start gap-2" data-testid={f.testid}>
                <f.icone className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden /> {f.texto}
              </li>
            ))}
          </ul>
        )}

        {proprietario?.bio && <p className="mt-4 text-sm leading-relaxed text-muted">{proprietario.bio}</p>}

        {(proprietario || onMensagem) && (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {proprietario && (
              <Link href={`/proprietario/${proprietario.id}`} className={buttonClasses({ variant: "secondary", size: "md", className: "w-full" })}>
                Ver perfil completo
              </Link>
            )}
            {onMensagem && (
              <button type="button" onClick={onMensagem} className={buttonClasses({ variant: "primary", size: "md", className: "w-full" })}>
                <MessageSquare className="h-4 w-4" aria-hidden /> Enviar mensagem
              </button>
            )}
          </div>
        )}
      </div>

      {/* Transparência do operador (sublocação autorizada) */}
      {property.ownershipType !== "own" && property.subleaseAuthorized && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-sage-100 px-3 py-1.5 text-xs font-medium text-forest">
          <Handshake className="h-3.5 w-3.5" />
          {property.ownershipType === "managed"
            ? "Administrado por gestor em nome do proprietário"
            : "Operado por gestor profissional, com sublocação autorizada pelo proprietário"}
        </p>
      )}
    </section>
  );
}
