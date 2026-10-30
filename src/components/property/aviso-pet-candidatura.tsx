"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PawPrint } from "lucide-react";
import { meusPets, type PetSalvo } from "@/lib/data/pets-ficha-actions";
import { linhaCompatibilidadePets, linhaValorPetCandidatura, ROTULO_ESPECIE, type RegrasPets } from "@/lib/anuncio/pets-regras";

/**
 * Antes de enviar a candidatura (ordem 022afabb, itens 1 e 4): mostra os pets da ficha que irão junto. E263-A: a
 * compatibilidade vira UMA linha neutra ("dentro das condições do dono" ou "confira com o dono: …"), só quando o dono
 * informou porte e quantidade; nunca bloqueia a candidatura. Sem sessão ou sem pets cadastrados, não mostra nada.
 */
export function AvisoPetCandidatura({
  petsAllowed,
  regras,
  exemplo = false,
}: {
  petsAllowed: boolean | undefined;
  regras: RegrasPets | null | undefined;
  /** Anúncio de exemplo (demonstração): não consulta o servidor. */
  exemplo?: boolean;
}) {
  const [pets, setPets] = useState<PetSalvo[]>([]);

  useEffect(() => {
    if (exemplo) return;
    let vivo = true;
    meusPets()
      .then((p) => vivo && setPets(p ?? []))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [exemplo]);

  if (pets.length === 0) return null;
  const compat = linhaCompatibilidadePets(petsAllowed, regras, pets);
  const valorPet = linhaValorPetCandidatura(petsAllowed, regras, pets.length);
  return (
    <div data-testid="pet-candidatura" className="rounded-xl border border-sage-200 bg-sage-100 px-3 py-3 text-xs text-ink">
      <p className="flex items-center gap-2 font-semibold">
        <PawPrint className="h-4 w-4 shrink-0" aria-hidden />
        Seus pets vão na candidatura
      </p>
      <p className="mt-1">{pets.map((p) => `${p.nome} (${ROTULO_ESPECIE[p.especie]}, porte ${p.porte})`).join(", ")}</p>
      {valorPet && (
        <p data-testid="pet-candidatura-valor" className="mt-1 font-semibold">
          {valorPet}
        </p>
      )}
      {compat && (
        <p data-testid="pet-compatibilidade" data-dentro={compat.dentro ? "1" : "0"} className="mt-1">
          {compat.texto}
        </p>
      )}
      <Link href="/dashboard/conta/perfil" className="mt-1 inline-block font-semibold underline">
        Ver minha ficha de pets
      </Link>
    </div>
  );
}
