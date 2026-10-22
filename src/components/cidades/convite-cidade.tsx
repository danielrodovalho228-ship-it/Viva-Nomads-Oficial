"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { MapPinned } from "lucide-react";
import { MUNICIPIOS } from "@/lib/municipios";
import { lerCidadeUf } from "@/lib/pedidos/formulario";
import { mensagemCidadeNaoLiberada, type PapelInteresse } from "@/lib/cidades-liberadas/regras";
import { registrarInteresseCidade, statusCidade } from "@/lib/cidades-liberadas/actions";
import { useAuthStore } from "@/lib/store";

/**
 * Convite quando a cidade buscada ainda não foi liberada (ordem 335b4064, item 3): o inquilino pode buscar qualquer
 * cidade; se não é uma das liberadas, aparece este aviso e o botão grava o interesse (só logado; o contato é o do perfil).
 * `texto` pode ser o rótulo digitado ("Goiânia – GO") — só vale cidade reconhecida na lista do IBGE.
 */
export function ConviteCidade({ texto, papel = "inquilino" }: { texto: string; papel?: PapelInteresse }) {
  const alvo = lerCidadeUf(MUNICIPIOS, texto);
  const logado = useAuthStore((s) => Boolean(s.user));
  const [fechada, setFechada] = useState(false);
  const [resp, setResp] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const cidade = alvo?.cidade ?? "";
  const uf = alvo?.uf ?? "";

  useEffect(() => {
    let vivo = true;
    if (!cidade) {
      Promise.resolve().then(() => vivo && (setFechada(false), setResp(null)));
      return () => {
        vivo = false;
      };
    }
    statusCidade(cidade, uf)
      .then((r) => {
        if (!vivo) return;
        setFechada(!r.liberada);
        setResp(null);
      })
      .catch(() => vivo && setFechada(false));
    return () => {
      vivo = false;
    };
  }, [cidade, uf]);

  if (!alvo || !fechada) return null;
  return (
    <div role="status" data-testid="convite-cidade" className="mt-4 flex max-w-md flex-col items-center gap-2 rounded-xl border border-sage-200 bg-surface-2 p-4 text-center">
      <MapPinned className="h-5 w-5 text-forest" aria-hidden />
      <p className="text-sm font-semibold text-ink">{mensagemCidadeNaoLiberada(cidade)}</p>
      {resp ? (
        <p className={resp.ok ? "text-sm text-ink" : "text-sm text-red-600"} role={resp.ok ? "status" : "alert"}>
          {resp.texto}
        </p>
      ) : logado ? (
        <button
          type="button"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await registrarInteresseCidade({ cidade, uf, papel });
              setResp({ ok: r.ok, texto: r.ok ? (r.mensagem ?? "Anotado!") : (r.erro ?? "Não foi possível registrar.") });
            })
          }
          className="inline-flex min-h-11 items-center rounded-full bg-gold px-4 text-sm font-semibold text-forest transition-colors hover:brightness-105 disabled:opacity-60"
          data-testid="convite-cidade-botao"
        >
          Avisem-me quando abrir
        </button>
      ) : (
        <Link href="/auth" className="inline-flex min-h-11 items-center rounded-full bg-gold px-4 text-sm font-semibold text-forest hover:brightness-105">
          Entrar para deixar meu interesse
        </Link>
      )}
    </div>
  );
}
