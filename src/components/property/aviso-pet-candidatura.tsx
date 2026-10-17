"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PawPrint, TriangleAlert } from "lucide-react";
import { meusPets, type PetSalvo } from "@/lib/data/pets-ficha-actions";
import { compatibilidadePets, linhaValorPetCandidatura, ROTULO_ESPECIE, type RegrasPets } from "@/lib/anuncio/pets-regras";

/**
 * Antes de enviar a candidatura (ordem 022afabb, itens 1 e 4): mostra os pets da ficha
 * que irão junto e avisa, em linguagem clara, quando algum não cabe nas regras do imóvel.
 * É só aviso: a pessoa decide se envia. Sem sessão ou sem pets cadastrados, não mostra nada.
 */
export function AvisoPetCandidatura({
  petsAllowed,
  regras,
}: {
  petsAllowed: boolean | undefined;
  regras: RegrasPets | null | undefined;
}) {
  const [pets, setPets] = useState<PetSalvo[]>([]);

  useEffect(() => {
    let vivo = true;
    meusPets()
      .then((p) => vivo && setPets(p ?? []))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  if (pets.length === 0) return null;
  const { ok, motivos } = compatibilidadePets(petsAllowed, regras ?? null, pets);
  const valorPet = linhaValorPetCandidatura(petsAllowed, regras, pets.length);
  return (
    <div
      data-testid={ok ? "pet-candidatura-ok" : "pet-candidatura-aviso"}
      className={`rounded-xl border px-3 py-2.5 text-xs ${ok ? "border-sage-200 bg-sage-100 text-ink" : "border-amber-300 bg-amber-50 text-amber-900"}`}
    >
      <p className="flex items-center gap-1.5 font-semibold">
        {ok ? <PawPrint className="h-4 w-4 shrink-0" /> : <TriangleAlert className="h-4 w-4 shrink-0" />}
        {ok ? "Seus pets vão na candidatura" : "Atenção: seu pet pode não caber nas regras deste imóvel"}
      </p>
      <p className="mt-1">{pets.map((p) => `${p.nome} (${ROTULO_ESPECIE[p.especie]}, porte ${p.porte})`).join(", ")}</p>
      {valorPet && (
        <p data-testid="pet-candidatura-valor" className="mt-1 font-semibold">
          {valorPet}
        </p>
      )}
      {!ok && (
        <ul className="mt-1 list-disc pl-4">
          {motivos.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      <Link href="/dashboard/conta" className="mt-1 inline-block font-semibold underline">
        Ver minha ficha de pets
      </Link>
    </div>
  );
}
