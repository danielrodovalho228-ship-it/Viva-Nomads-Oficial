"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkeletonLinhas } from "@/components/ui/skeleton";
import { AVISO_FOTO_COM_PESSOA, rotuloConfianca } from "@/lib/fotos/deteccao";
import { SUGESTAO_FOTOGRAFAR, SUGESTAO_SEM_FOTO, SUGESTAO_SO_REFERENCIA } from "@/lib/niveis/prova-camera";
import { ProvaNaHora } from "@/components/niveis/camera-prova";
import {
  analisarFotosDoAnuncio,
  confirmarSugestaoFoto,
  descartarSugestaoFoto,
  listarSugestoesFotos,
  type EstadoDeteccao,
} from "@/lib/data/deteccao-actions";

/** Rodadas seguidas ao entrar no passo (cada uma analisa poucas fotos; a galeria tem no máximo 40). */
const MAX_RODADAS = 8;

/**
 * DETECTA-B — "Encontramos nas suas fotos": sugestões de itens de Conforto/Premium e de comodidades achados nas fotos
 * da galeria. Nada conta antes de o dono confirmar. FOTO-NA-HORA-B: item de nível NÃO usa a foto da galeria (ela fica
 * só como referência); "Fotografar agora" confirma a sugestão ("Confirmada, falta a foto", não conta) e abre a câmera
 * do item — o item conta quando a foto feita na hora chega. Comodidade é marcada aqui pela tela (onComodidade) e
 * gravada pelo salvar do anúncio. Chave desligada ou qualquer falha: não aparece nada e o passo fica como hoje.
 */
export function SugestoesDasFotos({
  propertyId,
  comodidadesMarcadas,
  onComodidade,
  onSugeridas,
  onNivelMudou,
}: {
  propertyId: string | null;
  comodidadesMarcadas: readonly string[];
  onComodidade: (chave: string) => void;
  /** Itens de nível com sugestão esperando confirmação (saem do "o que falta"). */
  onSugeridas?: (chaves: string[]) => void;
  onNivelMudou?: () => void;
}) {
  const [estado, setEstado] = useState<EstadoDeteccao | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const avisar = useRef(onSugeridas);
  useEffect(() => {
    avisar.current = onSugeridas;
  }, [onSugeridas]);

  const aplicar = useCallback((e: EstadoDeteccao | null) => {
    setEstado(e);
    avisar.current?.(e?.ligada ? e.sugestoes.filter((s) => s.tipo === "nivel").map((s) => s.chave) : []);
  }, []);

  useEffect(() => {
    if (!propertyId) return;
    let vivo = true;
    (async () => {
      setAnalisando(true);
      try {
        for (let i = 0; i < MAX_RODADAS && vivo; i++) {
          const e = await analisarFotosDoAnuncio(propertyId);
          if (!vivo) return;
          aplicar(e);
          if (!e.ligada || e.limite || e.restantes === 0) break;
        }
      } catch {
        // A análise é ajuda, não trava: falhou, o passo segue como hoje.
      } finally {
        if (vivo) setAnalisando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [propertyId, aplicar]);

  if (!propertyId || !estado?.ligada) {
    return analisando ? <Analisando /> : null;
  }

  const marcadas = new Set(comodidadesMarcadas);
  const sugestoes = estado.sugestoes.filter((s) => s.tipo !== "comodidade" || !marcadas.has(s.chave));

  // Item de nível: confirmar = "Confirmada, falta a foto" (a câmera abre junto; a lista não recarrega para não fechá-la).
  async function decidir(id: string, confirmar: boolean, abrindoCamera = false) {
    if (!abrindoCamera) setOcupado(id);
    setMsg(null);
    try {
      const r = confirmar ? await confirmarSugestaoFoto(id) : await descartarSugestaoFoto(id);
      if (!r.ok) return setMsg({ ok: false, t: r.erro });
      if (r.comodidade) onComodidade(r.comodidade);
      if (abrindoCamera) return setEstado((e) => (e ? { ...e, sugestoes: e.sugestoes.map((x) => (x.id === id ? { ...x, status: "confirmada_sem_foto" as const } : x)) } : e));
      setMsg({ ok: true, t: r.mensagem });
      aplicar(await listarSugestoesFotos(propertyId!));
      if (confirmar) onNivelMudou?.();
    } catch {
      setMsg({ ok: false, t: "Não foi possível salvar agora." });
    } finally {
      setOcupado(null);
    }
  }

  if (!sugestoes.length && !estado.comPessoa && !analisando && !msg) return null;

  return (
    <section className="rounded-xl border border-sage-200 p-4" data-testid="deteccao-fotos">
      <h3 className="text-base font-semibold text-ink">Encontramos nas suas fotos</h3>
      <p className="mt-1 text-xs text-muted">Confirme o que está certo. Nada conta para o nível nem vira comodidade antes de você confirmar; item de nível só conta com a foto feita na hora.</p>
      {analisando && <Analisando />}
      {estado.comPessoa > 0 && (
        <p role="alert" className="mt-3 rounded-lg border border-line bg-white px-3 py-2 text-sm text-red-700" data-testid="deteccao-pessoa">
          {AVISO_FOTO_COM_PESSOA}
          <span className="text-muted">
            {" "}
            ({estado.comPessoa === 1 ? "1 foto da galeria" : `${estado.comPessoa} fotos da galeria`}). Para provar um item, use uma foto sem ninguém.
          </span>
        </p>
      )}
      {sugestoes.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-white">
          {sugestoes.map((s) =>
            s.tipo === "nivel" ? (
              <li key={s.id} className="flex flex-col gap-3 p-3 text-sm sm:flex-row sm:items-center" data-testid={`deteccao-sugestao-${s.chave}`} data-tipo={s.tipo} data-status={s.status}>
                <figure className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.fotoUrl} alt="" className="h-16 w-16 rounded-lg object-cover" loading="lazy" />
                  <figcaption className="mt-1 max-w-24 text-[11px] leading-tight text-muted" data-testid={`deteccao-referencia-${s.chave}`}>
                    {SUGESTAO_SO_REFERENCIA}
                  </figcaption>
                </figure>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{s.rotulo}</span>
                  <span className="block text-xs text-ink" data-testid={`deteccao-texto-${s.chave}`}>
                    {s.status === "confirmada_sem_foto" ? SUGESTAO_SEM_FOTO : SUGESTAO_FOTOGRAFAR}
                  </span>
                  <span className="block text-xs text-muted">Item de nível · confiança {rotuloConfianca(s.confianca)}</span>
                </span>
                <span className="flex shrink-0 flex-wrap gap-2">
                  <ProvaNaHora
                    propertyId={propertyId}
                    chave={s.chave}
                    rotulo={s.rotulo}
                    testid={`deteccao-fotografar-${s.chave}`}
                    onAbrir={() => void decidir(s.id, true, true)}
                    onRecebida={async (m) => {
                      setMsg({ ok: true, t: m });
                      aplicar(await listarSugestoesFotos(propertyId!).catch(() => estado));
                      onNivelMudou?.();
                    }}
                  />
                  <Button size="sm" variant="secondary" disabled={!!ocupado} onClick={() => decidir(s.id, false)} data-testid={`deteccao-descartar-${s.chave}`}>
                    Descartar
                  </Button>
                </span>
              </li>
            ) : (
              <li key={s.id} className="flex flex-col gap-3 p-3 text-sm sm:flex-row sm:items-center" data-testid={`deteccao-sugestao-${s.chave}`} data-tipo={s.tipo}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.fotoUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" loading="lazy" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{s.rotulo}</span>
                  <span className="block text-xs text-muted">Comodidade · confiança {rotuloConfianca(s.confianca)}</span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <Button size="sm" disabled={!!ocupado} onClick={() => decidir(s.id, true)} data-testid={`deteccao-confirmar-${s.chave}`}>
                    {ocupado === s.id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                    Confirmar
                  </Button>
                  <Button size="sm" variant="secondary" disabled={!!ocupado} onClick={() => decidir(s.id, false)} data-testid={`deteccao-descartar-${s.chave}`}>
                    Descartar
                  </Button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "mt-3 text-sm text-ink" : "mt-3 text-sm text-red-700"} data-testid="deteccao-msg">
          {msg.t}
        </p>
      )}
    </section>
  );
}

function Analisando() {
  return (
    <div className="mt-2">
      <span className="sr-only">Olhando as fotos da galeria…</span>
      <SkeletonLinhas linhas={2} testid="deteccao-analisando" />
    </div>
  );
}
