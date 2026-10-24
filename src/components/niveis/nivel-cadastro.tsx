"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ROTULO_AREA, ROTULO_NIVEL, rotuloItem } from "@/config/niveis";
import { VERSAO_CONFORTO } from "@/config/conforto-minimo";
import { nivelAgoraEFalta, type ItemQueFalta } from "@/lib/niveis/exibicao";
import { entradaNivelDoCadastro, type EntradaNivelCadastro } from "@/lib/data/nivel-cadastro-actions";
import { faltaSemSugestao } from "@/lib/fotos/deteccao";
import { ProvaNaHora } from "@/components/niveis/camera-prova";
import { AVISO_PROVA_NA_HORA, MARCA_FOTO_ANTERIOR, provaAntigaNoPrazo, textoRefazerFoto } from "@/lib/niveis/prova-camera";

/**
 * Adendo 59.1, Parte A — no passo Comodidades do cadastro: o nível que o imóvel atinge AGORA (com o padrão mínimo que
 * o dono está marcando logo acima) e, item a item, o que falta para o próximo, com a foto de cada item FEITA NA HORA
 * (FOTO-NA-HORA-B: câmera no celular, QR para o celular no computador; nunca da galeria). Provas anteriores à regra
 * aparecem com a marca e o prazo para refazer. Ruído e internet medida têm caminho próprio.
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

  const recebida = (m: string) => {
    setMsg({ ok: true, t: m });
    void carregar().catch(() => undefined);
  };
  const agora = new Date();
  const anteriores = base.itens.filter((i) => i.declarado && provaAntigaNoPrazo(i, agora) && i.refazerAte);

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
          <p className="mt-1 text-sm text-ink" data-testid="nivel-cadastro-aviso-camera">
            {AVISO_PROVA_NA_HORA}
          </p>
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
                          Foto recusada{recusa.get(i.chave) ? `: ${recusa.get(i.chave)}` : ""}. Fotografe de novo.
                        </span>
                      )}
                    </span>
                    <AcaoItem item={i} propertyId={propertyId} onRecebida={recebida} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {anteriores.length > 0 && (
        <div className="mt-3" data-testid="nivel-cadastro-anteriores">
          <ul className="divide-y divide-line rounded-lg border border-line bg-white">
            {anteriores.map((i) => (
              <li key={i.chave} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between" data-testid={`nivel-cadastro-anterior-${i.chave}`}>
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{rotuloItem(i.chave)}</span>
                  <span className="block text-xs text-amber-800">
                    {MARCA_FOTO_ANTERIOR} · {textoRefazerFoto(rotuloItem(i.chave), i.refazerAte!)}
                  </span>
                </span>
                <ProvaNaHora propertyId={propertyId} chave={i.chave} rotulo={rotuloItem(i.chave)} onRecebida={recebida} testid={`nivel-cadastro-foto-${i.chave}`} />
              </li>
            ))}
          </ul>
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

function AcaoItem({ item, propertyId, onRecebida }: { item: ItemQueFalta; propertyId: string; onRecebida: (m: string) => void }) {
  if (item.prova === "medida") return <span className="shrink-0 text-xs text-muted">Meça na edição do anúncio, depois de publicar</span>;
  if (item.prova === "ruido")
    return (
      <Link href={`/dashboard/imoveis/${propertyId}/nivel`} className="shrink-0 text-xs font-semibold text-forest underline underline-offset-2">
        Responder sobre o ruído
      </Link>
    );
  return <ProvaNaHora propertyId={propertyId} chave={item.chave} rotulo={item.rotulo} onRecebida={onRecebida} testid={`nivel-cadastro-foto-${item.chave}`} />;
}
