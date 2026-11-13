"use client";

import { createContext, useContext, useEffect } from "react";
import { useAuthStore, type SessionUser, type ViewMode } from "@/lib/store";
import { deveSemear, escolherModo, escolherUsuario, type SessaoDoServidor } from "@/lib/auth/painel-sessao-servidor";
import { useMontado } from "@/components/auth/montado";

/**
 * E793 Onda 0 — a sessão conferida no servidor chega ao cliente por PROP + Context (nunca pelo store global no servidor:
 * o zustand é um módulo compartilhado entre requisições e vazaria a sessão de uma pessoa para outra — risco H1).
 */
const Contexto = createContext<SessaoDoServidor | null>(null);

export function useSessaoServidor(): SessaoDoServidor | null {
  return useContext(Contexto);
}

/** A4: o usuário do quadro — 1º quadro só do servidor; depois, contexto ?? store até a conferência do cliente; depois, o store. */
export function useUsuarioAtual(): SessionUser | null {
  const contexto = useContext(Contexto);
  const montado = useMontado();
  const store = useAuthStore((s) => s.user);
  const authChecked = useAuthStore((s) => s.authChecked);
  return escolherUsuario({ montado, authChecked, contexto: contexto?.usuario ?? null, store });
}

/** A4: o modo do quadro, pela mesma regra. */
export function useModoAtual(): ViewMode | null {
  const contexto = useContext(Contexto);
  const montado = useMontado();
  const store = useAuthStore((s) => s.activeMode);
  const authChecked = useAuthStore((s) => s.authChecked);
  return escolherModo({ montado, authChecked, contexto: contexto?.modoInicial ?? null, store });
}

/** A5: depois de montar, semeia o store com o usuário do servidor (store vazio ou de outra conta). Só em useEffect. */
function SemearStore({ usuario }: { usuario: SessionUser }) {
  useEffect(() => {
    if (deveSemear(useAuthStore.getState().user, usuario)) useAuthStore.getState().setUser(usuario);
  }, [usuario]);
  return null;
}

export function SessaoServidorProvider({ valor, children }: { valor: SessaoDoServidor; children: React.ReactNode }) {
  return (
    <Contexto.Provider value={valor}>
      <SemearStore usuario={valor.usuario} />
      {children}
    </Contexto.Provider>
  );
}
