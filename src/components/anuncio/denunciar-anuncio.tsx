"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { denunciarAnuncio, minhaDenuncia } from "@/lib/saida/acoes";
import { MOTIVOS_DENUNCIA, ROTULO_ESTADO_DENUNCIA, type EstadoDenuncia } from "@/lib/saida/regras";

/**
 * Prompt 51 F1, item 6 — "Denunciar este anúncio" (terciário, no fim da página do imóvel). Motivo fechado + texto
 * opcional; pede conta; uma denúncia por conta por anúncio, com o estado visível (recebida · em análise · resolvida).
 * A denúncia vai à fila do atendimento e não tira o anúncio da busca sozinha.
 */
export function DenunciarAnuncio({ propertyId }: { propertyId: string }) {
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<{ logado: boolean; denuncia: { status: string; motivo: string } | null } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [texto, setTexto] = useState("");
  const [res, setRes] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    if (!aberto || estado) return;
    let vivo = true;
    minhaDenuncia(propertyId)
      .then((e) => vivo && setEstado(e))
      .catch(() => vivo && setEstado({ logado: false, denuncia: null }));
    return () => {
      vivo = false;
    };
  }, [aberto, estado, propertyId]);

  if (!aberto)
    return (
      <Button variant="tertiary" size="sm" onClick={() => setAberto(true)} data-testid="denunciar-anuncio">
        Denunciar este anúncio
      </Button>
    );

  return (
    <div className="rounded-xl border border-line p-4 text-sm" data-testid="denuncia-anuncio">
      {!estado ? (
        <p className="text-muted">Carregando…</p>
      ) : !estado.logado ? (
        <p className="text-ink">
          Para denunciar, <Link href={`/auth?redirect=${encodeURIComponent(`/imoveis/${propertyId}`)}`} className="font-semibold text-forest underline underline-offset-4">entre com seu e-mail</Link>.
        </p>
      ) : estado.denuncia ? (
        <p className="text-ink" data-testid="denuncia-estado" data-estado={estado.denuncia.status}>
          Você já denunciou este anúncio. Estado: <strong>{ROTULO_ESTADO_DENUNCIA[estado.denuncia.status as EstadoDenuncia] ?? estado.denuncia.status}</strong>.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData();
            f.set("propertyId", propertyId);
            f.set("motivo", motivo);
            f.set("texto", texto);
            iniciar(async () => {
              const r = await denunciarAnuncio(f);
              setRes(r.ok ? { ok: true, texto: r.mensagem ?? "Denúncia recebida." } : { ok: false, texto: r.erro });
              if (r.ok) setEstado({ logado: true, denuncia: { status: "recebida", motivo } });
            });
          }}
        >
          <fieldset className="grid gap-2">
            <legend className="mb-1 font-semibold text-ink">O que há de errado com este anúncio?</legend>
            {MOTIVOS_DENUNCIA.map((m) => (
              <label key={m.chave} className="flex min-h-11 items-center gap-3 text-ink">
                <input type="radio" name="motivo" value={m.chave} checked={motivo === m.chave} onChange={() => setMotivo(m.chave)} className="h-5 w-5 accent-forest" />
                {m.rotulo}
              </label>
            ))}
          </fieldset>
          <label className="mt-3 block text-ink">
            Quer contar mais? (opcional)
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-base" />
          </label>
          <Button type="submit" variant="outline" size="sm" className="mt-3" disabled={pendente || !motivo} data-testid="denuncia-enviar">
            Enviar denúncia
          </Button>
        </form>
      )}
      {res && (
        <p role={res.ok ? "status" : "alert"} className={res.ok ? "mt-2 text-ink" : "mt-2 text-red-700"} data-testid="denuncia-resultado">
          {res.texto}
        </p>
      )}
    </div>
  );
}
