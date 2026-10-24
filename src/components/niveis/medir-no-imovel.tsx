"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Wifi, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MedirInternet } from "@/components/anuncio/medir-internet";
import { useModoProva } from "@/components/niveis/camera-prova";
import { medicaoDoPonto, pedirLinkMedicao } from "@/lib/data/prova-actions";
import { BOTAO_MEDIR_AGORA, CONTINUAR_NO_CELULAR, LINK_CELULAR_MINUTOS, MEDIR_NO_IMOVEL, PREPARANDO_CAMERA } from "@/lib/niveis/prova-camera";
import type { Origem } from "@/lib/internet-medida-servidor";

/**
 * NIVEIS-MEDIR-B (E25b) — "Meça agora, no imóvel": o item de internet do nível (quarto principal, ponto de trabalho e
 * videochamada, que é a medição do ponto de trabalho) se resolve ainda no RASCUNHO, com as mesmas validações de sempre
 * (localização do aparelho, raio, confirmação do Wi-Fi). No celular, a medição abre ali mesmo; no computador, o mesmo
 * caminho do FOTO-NA-HORA (QR e link de uso único), porque a medição precisa ser feita no imóvel.
 */
export function MedirNoImovel({
  propertyId,
  ponto,
  origem,
  onMedida,
  testid,
}: {
  propertyId: string;
  ponto: "quarto_principal" | "trabalho";
  origem: Origem;
  /** Medição validada chegou (aqui ou pelo celular): quem mostra o nível relê. */
  onMedida: () => void;
  testid: string;
}) {
  const modo = useModoProva();
  const [aberto, setAberto] = useState(false);
  const celular = modo === "celular";
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={!modo}
        aria-busy={!modo}
        onClick={() => setAberto(true)}
        data-testid={`${testid}-botao`}
        data-modo={modo ?? "preparando"}
      >
        <Wifi className="h-4 w-4" aria-hidden />
        {/* O mesmo texto no celular e no computador; no computador o toque abre o QR para medir no imóvel. */}
        {!modo ? PREPARANDO_CAMERA : BOTAO_MEDIR_AGORA}
      </Button>
      {aberto && celular && (
        <div className="w-full" data-testid={`${testid}-medir`}>
          <MedirInternet imovelId={propertyId} origem={origem} pontoInicial={ponto} onMedida={(validada) => validada && onMedida()} />
        </div>
      )}
      {aberto && !celular && modo && <MedirPeloCelular propertyId={propertyId} ponto={ponto} onFechar={() => setAberto(false)} onMedida={onMedida} testid={testid} />}
    </div>
  );
}

function MedirPeloCelular({
  propertyId,
  ponto,
  onFechar,
  onMedida,
  testid,
}: {
  propertyId: string;
  ponto: "quarto_principal" | "trabalho";
  onFechar: () => void;
  onMedida: () => void;
  testid: string;
}) {
  const [link, setLink] = useState<{ url: string; qr: string; expiraEm: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [vencido, setVencido] = useState(false);
  const antes = useRef<string | null | undefined>(undefined);

  const aplicar = useCallback((r: Awaited<ReturnType<typeof pedirLinkMedicao>> | null) => {
    setVencido(false);
    if (!r?.ok) return setErro(r && !r.ok ? r.erro : "Não foi possível gerar o link agora.");
    setErro(null);
    setLink({ url: r.url, qr: r.qr, expiraEm: r.expiraEm });
  }, []);

  useEffect(() => {
    let vivo = true;
    medicaoDoPonto(propertyId, ponto)
      .catch(() => null)
      .then((m) => {
        if (vivo) antes.current = m;
      });
    pedirLinkMedicao(propertyId, ponto)
      .catch(() => null)
      .then((r) => {
        if (vivo) aplicar(r);
      });
    return () => {
      vivo = false;
    };
  }, [propertyId, ponto, aplicar]);

  // O item se atualiza sozinho: a cada 3 s, pergunta se chegou uma medição validada nova do ponto; o link vence em 30 min.
  useEffect(() => {
    if (!link) return;
    const t = setInterval(async () => {
      if (Date.now() >= Date.parse(link.expiraEm)) {
        setVencido(true);
        return clearInterval(t);
      }
      const m = await medicaoDoPonto(propertyId, ponto).catch(() => null);
      if (m && antes.current !== undefined && m !== antes.current) {
        clearInterval(t);
        onMedida();
      }
    }, 3000);
    return () => clearInterval(t);
  }, [link, propertyId, ponto, onMedida]);

  return (
    <div className="mt-1 w-full rounded-lg border border-line bg-white p-4 text-sm text-ink" data-testid={`${testid}-celular`}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">Meça a internet no imóvel, pelo celular</p>
        <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted" aria-label="Fechar" onClick={onFechar}>
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <p className="mt-1 text-muted">{MEDIR_NO_IMOVEL}</p>
      {erro && (
        <p className="mt-2 text-red-700" role="alert" data-testid={`${testid}-erro`}>
          {erro}
        </p>
      )}
      {link && !vencido && (
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={link.qr} alt="QR para abrir no celular" width={168} height={168} className="h-42 w-42 shrink-0" data-testid={`${testid}-qr`} />
          <div className="space-y-2">
            <p>Aponte a câmera do celular para o código. O link vale por {LINK_CELULAR_MINUTOS} minutos e uma vez só.</p>
            <a href={link.url} className="inline-block font-semibold text-forest underline underline-offset-2" data-testid={`${testid}-link`}>
              {CONTINUAR_NO_CELULAR}
            </a>
          </div>
        </div>
      )}
      {vencido && (
        <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={async () => aplicar(await pedirLinkMedicao(propertyId, ponto).catch(() => null))}>
          Gerar outro link
        </Button>
      )}
    </div>
  );
}
