"use client";

import { useState } from "react";
import {
  Ban,
  ChevronRight,
  Cigarette,
  Home,
  LogIn,
  LogOut,
  Moon,
  PartyPopper,
  PawPrint,
  ShieldCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Property } from "@/lib/types";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { linhasBomSaber, type ChaveBomSaber, type ChaveItemRegra } from "@/lib/anuncio/resumos-imovel";

const ICONES: Record<ChaveBomSaber, LucideIcon> = { cancelamento: Ban, regras: Home, seguranca: ShieldCheck };
/** CAMPOS-1: cada regra da casa com o seu ícone. */
const ICONES_REGRA: Record<ChaveItemRegra, LucideIcon> = {
  pessoas: Users,
  pets: PawPrint,
  entrada: LogIn,
  saida: LogOut,
  silencio: Moon,
  fumo: Cigarette,
  festas: PartyPopper,
  visitas: UserPlus,
};

/** Bloco "Bom saber": 3 linhas-resumo; cada uma abre o detalhe. As regras completas seguem em "Regras da estadia". */
export function BomSaber({ property }: { property: Property }) {
  const linhas = linhasBomSaber(property);
  const [aberta, setAberta] = useState<ChaveBomSaber | null>(null);
  const atual = linhas.find((l) => l.chave === aberta);
  return (
    <section aria-labelledby="bom-saber-title" data-testid="bom-saber">
      <h2 id="bom-saber-title" className="font-title text-2xl font-semibold text-ink">
        Bom saber
      </h2>
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-white">
        {linhas.map((l) => {
          const Icone = ICONES[l.chave];
          return (
            <li key={l.chave}>
              <button
                type="button"
                onClick={() => setAberta(l.chave)}
                data-testid={`bom-saber-${l.chave}`}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
              >
                <Icone className="h-5 w-5 shrink-0 text-forest" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{l.titulo}</span>
                  <span className="block truncate text-xs text-muted">{l.resumo}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      <BottomSheet open={!!atual} onClose={() => setAberta(null)} title={atual?.titulo ?? ""}>
        {atual?.itens && atual.itens.length > 0 ? (
          <ul className="space-y-3 text-sm text-ink" data-testid="regras-casa-lista">
            {atual.itens.map((it) => {
              const Icone = ICONES_REGRA[it.chave];
              return (
                <li key={it.chave} className="flex items-start gap-3" data-testid={`regra-casa-${it.chave}`}>
                  <Icone className="mt-1 h-5 w-5 shrink-0 text-sage" aria-hidden />
                  <span>{it.texto}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="space-y-2 text-sm text-ink">
            {atual?.detalhe.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
        {atual?.chave === "regras" && (
          <a
            href="#regras-da-estadia"
            onClick={() => setAberta(null)}
            className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-forest underline underline-offset-4"
          >
            Ver todas as regras da estadia
          </a>
        )}
      </BottomSheet>
    </section>
  );
}
