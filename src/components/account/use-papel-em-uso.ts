"use client";

import { useAuthStore } from "@/lib/store";
import { useViewMode } from "@/lib/roles";
import { useParceiroAprovado } from "@/lib/use-papel-barra";
import { papelDoModo } from "@/lib/papel/papel-ativo";
import type { Papel } from "@/lib/onboarding/ativacao";

/**
 * E537: o papel EM USO (decide o menu e o painel) — fonte única de "Como você usa a Viva" e do interruptor "Quero
 * morar" em Conta › Papéis. Admin não tem papel em uso (null).
 */
export function usePapelEmUso(): Papel | null {
  const admin = useAuthStore((s) => s.user?.role === "admin");
  const parceiroAtivo = useAuthStore((s) => s.parceiroAtivo);
  const { mode } = useViewMode();
  const aprovado = useParceiroAprovado();
  if (admin) return null;
  return parceiroAtivo && aprovado ? "parceiro" : papelDoModo(mode === "owner" ? "owner" : "tenant");
}
