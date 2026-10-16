"use client";

import { create } from "zustand";
import { listarMarcas } from "./actions";
import type { Marca } from "./regra";

interface MarcasState {
  carregado: boolean;
  porImovel: Record<string, Marca>;
  carregar: () => void;
  marcarVistoLocal: (id: string) => void;
}

let emVoo = false;

/** Marcas do usuário logado. Carrega uma vez por página; deslogado fica vazio (sem selo). */
export const useMarcasStore = create<MarcasState>()((set, get) => ({
  carregado: false,
  porImovel: {},
  carregar: () => {
    if (get().carregado || emVoo) return;
    emVoo = true;
    void listarMarcas()
      .then((m) => set({ porImovel: m, carregado: true }))
      .catch(() => set({ carregado: true }))
      .finally(() => {
        emVoo = false;
      });
  },
  marcarVistoLocal: (id) =>
    set((s) => ({
      porImovel: {
        ...s.porImovel,
        [id]: { vistoEm: s.porImovel[id]?.vistoEm ?? new Date().toISOString(), contatadoEm: s.porImovel[id]?.contatadoEm ?? null },
      },
    })),
}));
