"use client";

import { useState, useTransition } from "react";
import { Download, Link2, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmarNaPagina } from "@/components/ui/confirmar-na-pagina";
import { definirNomeNoCartao, registrarCompartilhamento, trocarMeuCodigo } from "@/lib/data/cartoes-actions";
import type { PacoteDeCompartilhar } from "@/lib/data/cartoes-servidor";

/**
 * Compartilhar um cartão (Fase 1): prévia, formato (1080×1350 ou 1080×1080) e UM toque para o WhatsApp — com a
 * imagem quando o aparelho deixa (compartilhar do sistema), senão a legenda pronta com o link curto. Modelo travado:
 * nada de texto livre; no cartão-postal, a pessoa só escolhe mostrar ou não o primeiro nome.
 * Cartão do parceiro (partnercard, 31c): prévia nos dois formatos, "Compartilhar" pelo compartilhar do aparelho
 * (Web Share API; sem suporte, copia o link). O título é sempre o nome público do negócio (sem opt-in).
 */
export function CartaoCompartilhar({ inicial }: { inicial: PacoteDeCompartilhar }) {
  const [pacote, setPacote] = useState(inicial);
  const [formato, setFormato] = useState<"retrato" | "quadrado">("retrato");
  const [versao, setVersao] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const imagem = `${formato === "retrato" ? pacote.imagemRetrato : pacote.imagemQuadrado}&v=${versao}`;
  const parceiro = pacote.tipo === "partnercard";
  const nomeArquivo = `viva-nomads-${pacote.tipo === "poststay" ? "cartao-postal" : parceiro ? "parceiro" : "anuncio"}-${formato}.png`;

  /** Parceiro: compartilhar do aparelho (com a imagem quando dá; senão o link); sem suporte, copia o link. */
  async function compartilharParceiro() {
    setMsg(null);
    void registrarCompartilhamento(pacote.curto, "sistema");
    try {
      const blob = await (await fetch(imagem)).blob();
      const arquivo = new File([blob], nomeArquivo, { type: "image/png" });
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], text: pacote.legenda });
        return;
      }
      if (typeof navigator.share === "function") {
        await navigator.share({ url: pacote.link, text: pacote.legenda });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    await copiar();
  }

  async function compartilhar() {
    setMsg(null);
    // O toque conta na hora (cards_shared), antes de baixar a imagem: rede lenta não perde a métrica.
    void registrarCompartilhamento(pacote.curto, "whatsapp");
    try {
      const blob = await (await fetch(imagem)).blob();
      const arquivo = new File([blob], nomeArquivo, { type: "image/png" });
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], text: pacote.legenda });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // a pessoa fechou a folha de compartilhar
    }
    // wa.me com a legenda pronta (mesmo formato de linkWhatsapp em lib/cartoes/compartilhar.ts).
    window.open(`https://wa.me/?text=${encodeURIComponent(pacote.legenda)}`, "_blank", "noopener,noreferrer");
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(pacote.link);
      setMsg("Link copiado.");
      void registrarCompartilhamento(pacote.curto, "copiar");
    } catch {
      setMsg(`Copie o link: ${pacote.link}`);
    }
  }

  function trocarNome(mostrar: boolean) {
    iniciar(async () => {
      const r = await definirNomeNoCartao(pacote.curto, mostrar);
      if (r.ok) {
        setPacote(r.valor);
        setVersao((v) => v + 1);
      } else setMsg(r.error);
    });
  }

  function trocarCodigo() {
    iniciar(async () => {
      const r = await trocarMeuCodigo();
      if (r.ok) {
        setVersao((v) => v + 1);
        setMsg("Código trocado. O QR e o link antigos não contam mais para você.");
      } else setMsg(r.error);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]" data-testid="cartao-compartilhar" data-curto={pacote.curto} data-tipo={pacote.tipo}>
      <div className="min-w-0">
        {parceiro ? (
          <div className="grid grid-cols-2 gap-3" data-testid="cartao-previas">
            {(["retrato", "quadrado"] as const).map((f) => (
              <figure key={f} className="min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada no servidor, já no tamanho final */}
                <img
                  src={`${f === "retrato" ? pacote.imagemRetrato : pacote.imagemQuadrado}&v=${versao}`}
                  alt={`Prévia do cartão do parceiro (${f === "retrato" ? "1080×1350" : "1080×1080"})`}
                  className="w-full rounded-xl border border-line bg-surface-2 "
                  width={1080}
                  height={f === "retrato" ? 1350 : 1080}
                  data-testid={f === "retrato" ? "cartao-previa" : "cartao-previa-quadrado"}
                />
                <figcaption className="mt-1 text-center text-xs text-muted">{f === "retrato" ? "1080×1350" : "1080×1080"}</figcaption>
              </figure>
            ))}
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- imagem gerada no servidor, já no tamanho final
          <img
            src={imagem}
            alt={pacote.tipo === "poststay" ? "Prévia do seu cartão-postal" : "Prévia do cartão do seu anúncio"}
            className="w-full rounded-xl border border-line bg-surface-2 "
            width={1080}
            height={formato === "retrato" ? 1350 : 1080}
            data-testid="cartao-previa"
          />
        )}
        <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Formato">
          {(["retrato", "quadrado"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={formato === f}
              onClick={() => setFormato(f)}
              className={`h-10 rounded-lg border text-sm font-semibold ${formato === f ? "border-blue-500 bg-blue-50 text-blue-700" : "border-line bg-white text-ink"}`}
              data-testid={`cartao-formato-${f}`}
            >
              {f === "retrato" ? "Story/Feed 1080×1350" : "Quadrado 1080×1080"}
            </button>
          ))}
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        {parceiro ? (
          <Button size="lg" className="w-full sm:w-auto" onClick={compartilharParceiro} data-testid="cartao-compartilhar-sistema">
            <Share2 className="h-5 w-5" /> Compartilhar
          </Button>
        ) : (
          <Button size="lg" className="w-full sm:w-auto" onClick={compartilhar} data-testid="cartao-compartilhar-whatsapp">
            <MessageCircle className="h-5 w-5" /> Compartilhar no WhatsApp
          </Button>
        )}
        <p className="text-sm text-muted [overflow-wrap:anywhere]" data-testid="cartao-legenda">
          {pacote.legenda}
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={imagem}
            download={nomeArquivo}
            onClick={() => void registrarCompartilhamento(pacote.curto, "baixar")}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-500 bg-white px-4 text-sm font-semibold text-blue-500 hover:bg-blue-50"
            data-testid="cartao-baixar"
          >
            <Download className="h-4 w-4" /> Baixar imagem
          </a>
          <Button variant="secondary" size="sm" onClick={copiar} data-testid="cartao-copiar-link">
            <Link2 className="h-4 w-4" /> Copiar link
          </Button>
        </div>
        {pacote.tipo === "poststay" && (
          <label className="flex items-center gap-3 rounded-xl border border-line bg-white p-3 text-sm text-ink">
            <Switch checked={pacote.mostrarNome} onChange={trocarNome} disabled={pendente} label="Mostrar meu primeiro nome no cartão" />
            <span data-testid="cartao-nome-opcao">Mostrar meu primeiro nome no cartão (só o primeiro nome; sem sobrenome nem contato)</span>
          </label>
        )}
        {parceiro ? (
          <p className="text-sm text-ink" data-testid="cartao-parceiro-explicacao">
            Quem escanear cai na sua página na Viva e pede orçamento por lá. Contato sempre pela plataforma.
          </p>
        ) : (
          <p className="text-xs text-muted">
            O QR e o link levam à página do imóvel na Viva Nomads. Quem abre não precisa entrar na conta. O cartão só mostra
            {pacote.tipo === "poststay" ? " a cidade e o mês/ano da estadia" : " título, bairro, cidade, valor mensal e período"}.
          </p>
        )}
        <div className="border-t border-line pt-3">
          <ConfirmarNaPagina
            aviso="Trocar o código do QR? Os cartões e links que você já mandou continuam abrindo o imóvel, mas deixam de contar como seus."
            confirmar="Trocar código"
            onConfirmar={trocarCodigo}
            disabled={pendente}
            variant="ghost"
            size="sm"
            testid="cartao-trocar-codigo"
          >
            Trocar o código do QR
          </ConfirmarNaPagina>
        </div>
        {msg && (
          <p className="text-sm text-ink" role="status" data-testid="cartao-msg">
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}
