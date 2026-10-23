"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { emAndamentoDoAnuncio, pausarAnuncio, reativarAnuncio } from "@/lib/data/actions";
import { donoPodeReativar, textoDaPausa, textoEmAndamento } from "@/lib/anuncio/pausa";
import { cn } from "@/lib/utils";

const ROTULO = { draft: "Rascunho", active: "Ativo", paused: "Pausado" } as const;
const TOM = { draft: "bg-amber-50 text-amber-700", active: "bg-sage-100 text-forest", paused: "bg-surface-2 text-muted" } as const;

type Status = keyof typeof ROTULO;

/**
 * 64-B — o selo de estado do anúncio vira o menu de pausa (Meus imóveis e topo do editor). Ativo → "Pausar anúncio"
 * (antes de confirmar, a lista do que continua em andamento). Pausado pelo dono → "Reativar" (pela mesma porta da
 * publicação; faltando algo, a lista com o link de cada item). Pausado pela Viva → o motivo e o caminho, sem botão.
 */
export function EstadoDoAnuncio({ id, status, motivo }: { id: string; status: Status; motivo: string | null }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [etapa, setEtapa] = useState<"nada" | "confirmar" | "faltas">("nada");
  const [andamento, setAndamento] = useState<string[] | null>(null);
  const [faltas, setFaltas] = useState<{ rotulo: string; href: string }[]>([]);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const selo = (extra?: React.ReactNode) => (
    <>
      {ROTULO[status]}
      {extra}
    </>
  );
  const classeSelo = cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium", TOM[status]);

  if (status === "draft") {
    return (
      <span className={classeSelo} data-testid="estado-anuncio" data-status={status}>
        {selo()}
      </span>
    );
  }

  const daViva = status === "paused" && !donoPodeReativar(motivo);
  if (daViva) {
    const t = textoDaPausa(motivo);
    return (
      <>
        <span className={classeSelo} data-testid="estado-anuncio" data-status={status} data-motivo={motivo ?? "admin"}>
          {selo()}
        </span>
        <p className="w-full basis-full text-sm text-ink" data-testid="pausa-viva">
          {t.motivo}{" "}
          {t.caminho && (
            <Link href={t.caminho.href} className="font-semibold text-forest underline underline-offset-4">
              {t.caminho.rotulo}
            </Link>
          )}
        </p>
      </>
    );
  }

  function abrirPausa() {
    setAberto(false);
    setAviso(null);
    setEtapa("confirmar");
    setAndamento(null);
    emAndamentoDoAnuncio(id)
      .then((e) => setAndamento(e ? textoEmAndamento(e) : []))
      .catch(() => setAndamento([]));
  }

  function confirmarPausa() {
    iniciar(async () => {
      const r = await pausarAnuncio(id);
      if (!r.ok) return setAviso({ ok: false, texto: r.erro });
      setEtapa("nada");
      setAviso({ ok: true, texto: r.mensagem ?? "Anúncio pausado." });
      router.refresh();
    });
  }

  function reativar() {
    setAberto(false);
    setAviso(null);
    iniciar(async () => {
      const r = await reativarAnuncio(id);
      if (r.ok) {
        setEtapa("nada");
        setAviso({ ok: true, texto: r.mensagem ?? "Anúncio reativado." });
        router.refresh();
        return;
      }
      setFaltas(r.faltas ?? []);
      setEtapa("faltas");
      setAviso({ ok: false, texto: r.erro });
    });
  }

  return (
    <>
      <div ref={raiz} className="relative">
        <button
          type="button"
          className={classeSelo}
          data-testid="estado-anuncio"
          data-status={status}
          data-motivo={motivo ?? ""}
          aria-haspopup="menu"
          aria-expanded={aberto}
          onClick={() => setAberto((v) => !v)}
        >
          {selo(<ChevronDown className="h-3.5 w-3.5" aria-hidden />)}
        </button>
        {aberto && (
          <div role="menu" className="absolute left-0 z-20 mt-1 w-48 rounded-xl border border-line bg-white p-1 text-sm">
            {status === "active" ? (
              <button type="button" role="menuitem" className="flex min-h-11 w-full items-center rounded-lg px-3 text-left font-semibold text-ink hover:bg-sage-100" onClick={abrirPausa} data-testid="pausar-anuncio">
                Pausar anúncio
              </button>
            ) : (
              <button type="button" role="menuitem" className="flex min-h-11 w-full items-center rounded-lg px-3 text-left font-semibold text-ink hover:bg-sage-100" onClick={reativar} data-testid="reativar-anuncio">
                Reativar
              </button>
            )}
          </div>
        )}
      </div>

      {etapa === "confirmar" && (
        <div className="w-full basis-full rounded-xl border border-line p-3 text-sm" data-testid="confirmar-pausa-painel">
          <p className="font-semibold text-ink">Pausar este anúncio?</p>
          <p className="mt-1 text-ink/80">Ele sai da busca e do mapa e para de receber pedidos novos. Você pode reativar quando quiser.</p>
          {andamento === null ? (
            <p className="mt-2 text-muted">Conferindo o que está em andamento…</p>
          ) : andamento.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-ink" data-testid="pausa-em-andamento">
              {andamento.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={pendente} onClick={confirmarPausa} data-testid="confirmar-pausa">
              Pausar
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={pendente} onClick={() => setEtapa("nada")}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {etapa === "faltas" && faltas.length > 0 && (
        <ul className="w-full basis-full space-y-1 rounded-xl border border-line p-3 text-sm" data-testid="reativar-faltas">
          {faltas.map((f) => (
            <li key={f.rotulo}>
              <Link href={f.href} className="text-ink underline underline-offset-4 hover:text-forest">
                {f.rotulo}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {aviso && (
        <p role={aviso.ok ? "status" : "alert"} className={cn("w-full basis-full text-sm", aviso.ok ? "text-forest" : "text-red-700")} data-testid="estado-anuncio-aviso">
          {aviso.texto}
        </p>
      )}
    </>
  );
}
