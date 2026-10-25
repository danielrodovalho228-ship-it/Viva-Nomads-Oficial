"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { avisarFotografoNaCidade } from "@/lib/fotografos/aviso-actions";
import { CONVITE_AVISO, TEXTO_AVISO_DESLOGADO, linkEntrarParaAvisar } from "@/lib/fotografos/aviso";

/**
 * Busca sem fotógrafo na cidade (QA do Muse, 18/10): sempre há uma saída — "avise-me quando houver" (gravado por
 * cidade, contato do perfil) e seguir com as próprias fotos. Sem login: entrar (ou criar a conta) e voltar para a
 * mesma busca com ?avisar=1 — o aviso é gravado na volta, sem outro clique (complemento do P29, item 5a).
 */
export function AvisoFotografo({
  cidade,
  uf,
  logado,
  voltarPara,
  autoAvisar = false,
  categoria = "fotografia",
}: {
  cidade: string;
  uf: string;
  logado: boolean;
  voltarPara: string;
  /** Voltou do login pelo link do aviso: grava já. */
  autoAvisar?: boolean;
  /** Prompt 31a: o avise-me vale para qualquer categoria de parceiro. */
  categoria?: string;
}) {
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const jaPediu = useRef(false);

  useEffect(() => {
    if (!autoAvisar || !logado || !uf || jaPediu.current) return;
    jaPediu.current = true;
    // Tira o ?avisar=1 da barra: recarregar a página não pede de novo.
    try {
      window.history.replaceState(null, "", voltarPara);
    } catch {
      /* sem history: segue */
    }
    void avisar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAvisar, logado, uf]);

  async function avisar() {
    setEnviando(true);
    const r: { ok: boolean; erro?: string; mensagem?: string } = await avisarFotografoNaCidade({ cidade, uf, categoria }).catch(() => ({ ok: false, erro: "Sem conexão. Tente de novo." }));
    setEnviando(false);
    setMsg({ ok: r.ok, texto: (r.ok ? r.mensagem : r.erro) ?? "" });
  }

  return (
    <div className="mt-4 rounded-xl border border-sage-200 bg-sage-50 p-4" data-testid="aviso-fotografo">
      <p className="flex items-center gap-2 font-semibold text-ink">
        <BellRing className="size-5 shrink-0 text-forest" aria-hidden /> {categoria === "fotografia" ? CONVITE_AVISO : "Avisamos você quando houver um parceiro desta categoria na sua cidade."}
      </p>
      {enviando && !msg && autoAvisar && (
        <p className="mt-2 text-sm text-ink" role="status">
          Registrando o seu pedido de aviso…
        </p>
      )}
      {msg?.ok ? (
        <p className="mt-2 text-sm text-forest" role="status" data-testid="aviso-fotografo-ok">
          {msg.texto}
        </p>
      ) : logado ? (
        <button type="button" onClick={() => void avisar()} disabled={enviando || !uf} className={buttonClasses({ className: "mt-3 w-full sm:w-auto disabled:opacity-60" })} data-testid="aviso-fotografo-enviar">
          {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />} Quero ser avisado
        </button>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-ink" data-testid="aviso-fotografo-deslogado">
            {categoria === "fotografia" ? TEXTO_AVISO_DESLOGADO : "Entre ou crie sua conta para ser avisado quando houver parceiro na sua cidade"}.
          </p>
          <ButtonLink href={linkEntrarParaAvisar(voltarPara)} className="mt-2 w-full sm:w-auto" data-testid="aviso-fotografo-entrar">
            Entrar ou criar conta
          </ButtonLink>
        </div>
      )}
      {!uf && !msg && <p className="mt-2 text-xs text-ink/70">Busque pelo CEP (ou escolha o estado) para sabermos a cidade e o estado.</p>}
      {msg && !msg.ok && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {msg.texto}
        </p>
      )}
      {categoria === "fotografia" && <p className="mt-3 text-xs text-ink/70">Enquanto isso, você pode publicar com as suas próprias fotos: o anúncio sai normalmente.</p>}
    </div>
  );
}
