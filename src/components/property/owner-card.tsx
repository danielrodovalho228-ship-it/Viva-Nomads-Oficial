import Image from "next/image";
import { BadgeCheck, Clock, Handshake } from "lucide-react";
import type { Property } from "@/lib/types";
import { ResponsiveOwnerBadge } from "@/components/ui/badge";

/** "desde 2025" / "desde mar. 2025" a partir de uma data ISO. */
function memberSinceLabel(iso?: string): string | null {
  if (!iso) return null;
  const year = iso.slice(0, 4);
  return year.length === 4 ? `Anuncia no Viva Nomads desde ${year}` : null;
}

/**
 * Bloco de confiança do proprietário: foto/inicial, nome, tempo na plataforma,
 * taxa de resposta e selo de verificado. Sem expor contato direto — a conversa
 * acontece pela plataforma (botões do card de preço).
 */
export function OwnerCard({ property }: { property: Property }) {
  const owner = property.owner;
  const name = owner?.name ?? property.ownerName;
  if (!name) return null;

  const since = memberSinceLabel(owner?.memberSince);

  return (
    <section aria-labelledby="proprietario-title">
      <h2 id="proprietario-title" className="font-title text-2xl font-bold text-ink">
        Proprietário
      </h2>

      <div className="mt-5 flex items-start gap-4 rounded-2xl border border-sage-200 p-5">
        {owner?.avatarUrl ? (
          <Image
            src={owner.avatarUrl}
            alt={`Foto de ${name}`}
            width={56}
            height={56}
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-sage-100 font-title text-lg font-bold text-forest">
            {name.charAt(0)}
          </div>
        )}

        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-title font-bold text-ink">
            {name}
            {(owner?.verified ?? true) && <BadgeCheck className="h-4 w-4 text-blue-600" />}
          </p>
          <p className="text-sm text-muted">Proprietário verificado</p>
          <div className="mt-1.5">
            <ResponsiveOwnerBadge />
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-sm text-ink">
            {since && (
              <span className="inline-flex items-center gap-1.5">
                <Handshake className="h-4 w-4 text-sage" /> {since}
              </span>
            )}
            {owner?.responseRate != null && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-sage" /> Responde {owner.responseRate}% das mensagens
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Transparência do operador (sublocação autorizada) */}
      {property.ownershipType === "subleased" && property.subleaseAuthorized && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-sage-100 px-3 py-1.5 text-xs font-medium text-forest">
          <Handshake className="h-3.5 w-3.5" />
          Operado por gestor profissional, com sublocação autorizada pelo proprietário
        </p>
      )}
    </section>
  );
}
