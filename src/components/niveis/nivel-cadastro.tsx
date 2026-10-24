"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { ROTULO_AREA, ROTULO_NIVEL } from "@/config/niveis";
import { VERSAO_CONFORTO } from "@/config/conforto-minimo";
import { nivelAgoraEFalta, type ItemQueFalta } from "@/lib/niveis/exibicao";
import { entradaNivelDoCadastro, type EntradaNivelCadastro } from "@/lib/data/nivel-cadastro-actions";
import { salvarItemNivel } from "@/lib/data/nivel-actions";
import { faltaSemSugestao } from "@/lib/fotos/deteccao";

/** Envia a foto pelo upload do anúncio (re-codificada sem EXIF, na pasta do dono) e devolve o caminho. */
async function enviarFoto(arquivo: File): Promise<{ ok: true; path: string } | { ok: false; erro: string }> {
  const fd = new FormData();
  fd.set("file", arquivo);
  const r = await fetch("/api/upload/foto", { method: "POST", body: fd });
  const j = (await r.json().catch(() => ({}))) as { path?: string; error?: string };
  return r.ok && j.path ? { ok: true, path: j.path } : { ok: false, erro: j.error ?? "Não foi possível enviar a foto." };
}

/**
 * Adendo 59.1, Parte A — no passo Comodidades do cadastro: o nível que o imóvel atinge AGORA (com o padrão mínimo que
 * o dono está marcando logo acima) e, item a item, o que falta para o próximo, com o envio da foto em cada item.
 * Ruído e internet medida têm caminho próprio (página do nível e edição do anúncio).
 */
export function NivelNoCadastro({
  propertyId,
  conforto,
  sugeridas = [],
  recarregar = 0,
}: {
  propertyId: string | null;
  conforto: string[];
  /** DETECTA-B: itens com sugestão das fotos esperando confirmação — aparecem lá, não no "o que falta". */
  sugeridas?: readonly string[];
  /** Muda quando outro bloco grava um item (ex.: sugestão confirmada) para reler o nível. */
  recarregar?: number;
}) {
  const [entrada, setEntrada] = useState<EntradaNivelCadastro | null>(null);
  const [carregou, setCarregou] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const carregar = useCallback(async () => {
    if (!propertyId) return;
    const e = await entradaNivelDoCadastro(propertyId).catch(() => null);
    setEntrada(e);
    setCarregou(true);
  }, [propertyId]);

  useEffect(() => {
    if (!propertyId) return;
    let vivo = true;
    entradaNivelDoCadastro(propertyId)
      .catch(() => null)
      .then((e) => {
        if (!vivo) return;
        setEntrada(e);
        setCarregou(true);
      });
    return () => {
      vivo = false;
    };
  }, [propertyId, recarregar]);

  if (!propertyId) {
    return (
      <p className="rounded-xl border border-line bg-white p-4 text-sm text-muted" data-testid="nivel-cadastro-sem-rascunho">
        O nível do imóvel aparece aqui assim que o rascunho for salvo.
      </p>
    );
  }
  if (!carregou) return null;

  const base = entrada ?? { itens: [], medidas: [], ruido: null, bloqueadas: [], fotos: [] };
  const { nivel, proximo, falta: faltaTudo } = nivelAgoraEFalta({
    declaracoesConforto: conforto.map((chave) => ({ chave, confirmado: true, versao_lista: VERSAO_CONFORTO })),
    itens: base.itens,
    medidas: base.medidas,
    ruido: base.ruido,
    bloqueadas: base.bloqueadas,
    agora: new Date(),
  });
  const falta = faltaSemSugestao(faltaTudo, new Set(sugeridas));
  const recusa = new Map(base.fotos.filter((f) => f.status === "recusada").map((f) => [f.chave, f.motivo]));

  async function enviar(item: ItemQueFalta, arquivo: File) {
    setEnviando(item.chave);
    setMsg(null);
    try {
      const up = await enviarFoto(arquivo);
      if (!up.ok) return setMsg({ ok: false, t: up.erro });
      const r = await salvarItemNivel(propertyId!, item.chave, true, up.path);
      setMsg(r.ok ? { ok: true, t: `Foto de "${item.rotulo}" enviada. O item já conta enquanto a foto é analisada.` } : { ok: false, t: r.erro });
      if (r.ok) await carregar();
    } finally {
      setEnviando(null);
    }
  }

  return (
    <section className="rounded-xl border border-sage-200 p-4" data-testid="nivel-cadastro" data-nivel={nivel}>
      <h3 className="text-base font-semibold text-ink">Nível do anúncio</h3>
      <p className="mt-1 text-sm text-ink" data-testid="nivel-cadastro-agora" data-nivel={nivel}>
        {nivel === "em_adequacao" ? (
          "Abaixo do Essencial: confirme os itens do padrão mínimo acima."
        ) : (
          <>
            Agora: <strong>{ROTULO_NIVEL[nivel]}</strong>
            {proximo ? "" : ". É o nível mais alto."}
          </>
        )}
      </p>
      {proximo && proximo !== "essencial" && falta.length > 0 && (
        <div className="mt-3" data-testid="nivel-cadastro-falta" data-proximo={proximo}>
          <p className="text-sm font-semibold text-ink">Para chegar a {ROTULO_NIVEL[proximo]}</p>
          <p className="text-xs text-muted">Uma foto por item, sem pessoas. O nível é o da área mais fraca.</p>
          {falta.map((g) => (
            <div key={g.area} className="mt-3">
              <p className="text-xs font-semibold text-muted">{ROTULO_AREA[g.area]}</p>
              <ul className="mt-1 divide-y divide-line rounded-lg border border-line bg-white">
                {g.itens.map((i) => (
                  <li key={i.chave} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between" data-testid={`nivel-cadastro-item-${i.chave}`}>
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">{i.rotulo}</span>
                      <span className="block text-xs text-muted">{i.criterio}</span>
                      {recusa.has(i.chave) && (
                        <span className="block text-xs text-red-700" data-testid={`nivel-cadastro-recusada-${i.chave}`}>
                          Foto recusada{recusa.get(i.chave) ? `: ${recusa.get(i.chave)}` : ""}. Envie outra.
                        </span>
                      )}
                    </span>
                    <AcaoItem item={i} propertyId={propertyId} enviando={enviando === i.chave} bloqueado={!!enviando} onFoto={(f) => enviar(i, f)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "mt-3 text-sm text-ink" : "mt-3 text-sm text-red-700"} data-testid="nivel-cadastro-msg">
          {msg.t}
        </p>
      )}
      <Link href={`/dashboard/imoveis/${propertyId}/nivel`} className="mt-3 inline-block text-sm font-semibold text-forest underline underline-offset-2" data-testid="nivel-cadastro-ver-tudo">
        Ver nível, ruído e extras
      </Link>
    </section>
  );
}

function AcaoItem({ item, propertyId, enviando, bloqueado, onFoto }: { item: ItemQueFalta; propertyId: string; enviando: boolean; bloqueado: boolean; onFoto: (f: File) => void }) {
  if (item.prova === "medida") return <span className="shrink-0 text-xs text-muted">Meça na edição do anúncio, depois de publicar</span>;
  if (item.prova === "ruido")
    return (
      <Link href={`/dashboard/imoveis/${propertyId}/nivel`} className="shrink-0 text-xs font-semibold text-forest underline underline-offset-2">
        Responder sobre o ruído
      </Link>
    );
  return (
    <label className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-forest">
      {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {enviando ? "Enviando…" : "Enviar foto"}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={bloqueado}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFoto(f);
          e.target.value = "";
        }}
        data-testid={`nivel-cadastro-foto-${item.chave}`}
      />
    </label>
  );
}
