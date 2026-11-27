"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assinarContrato, pedirCodigoAssinatura } from "@/lib/data/contrato-assinar-actions";
import { HREF_CONFIRMADA } from "@/lib/estadia/confirmacao";
import { MSG_FALTAM_INSTRUCOES } from "@/lib/checkin";
import { EVENTO_AVISO_ASSINATURA } from "./aviso-assinatura";

/**
 * “Li e concordo” + código de 6 dígitos enviado ao e-mail da conta (conferido no servidor) → assina.
 * E1065: `faltamInstrucoes` é o que a página já sabe ao abrir — o proprietário ainda não preencheu as instruções de
 * entrada, e o servidor recusa o código por isso. O motivo fica JUNTO do botão do código, antes do clique.
 */
export function AssinarContrato({ contratoId, faltamInstrucoes = false }: { contratoId: string; faltamInstrucoes?: boolean }) {
  const router = useRouter();
  const [aceite, setAceiteEstado] = useState(false);
  // "Li e concordo" sobrevive a recarregar a página (jornada de assinatura, 19/10): guardado por contrato no
  // sessionStorage e limpo depois de assinar. O servidor continua exigindo o aceite no envio.
  const chave = `vn-li-concordo:${contratoId}`;
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura a marcação depois da hidratação
      if (window.sessionStorage.getItem(chave) === "1") setAceiteEstado(true);
    } catch {
      /* sem armazenamento (aba privada): segue desmarcado */
    }
  }, [chave]);
  const setAceite = (v: boolean) => {
    setAceiteEstado(v);
    try {
      if (v) window.sessionStorage.setItem(chave, "1");
      else window.sessionStorage.removeItem(chave);
    } catch {
      /* sem armazenamento */
    }
  };
  const [codigo, setCodigo] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [pedindo, setPedindo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [assinado, setAssinado] = useState(false);
  // E1065: cada erro fica junto do botão que o causou. `erro` é o do pedido do código ("Enviar código por e-mail");
  // `erroAssinar` é o do envio da assinatura ("Assinar contrato").
  const [erro, setErro] = useState<string | null>(null);
  const [erroAssinar, setErroAssinar] = useState<string | null>(null);
  // Quando a página passa a saber que as instruções foram preenchidas, a recusa antiga por falta delas sai da tela.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- limpa a recusa que deixou de valer depois do refresh
    if (!faltamInstrucoes) setErro((e) => (e === MSG_FALTAM_INSTRUCOES ? null : e));
  }, [faltamInstrucoes]);

  async function pedir() {
    setErro(null);
    setPedindo(true);
    try {
      const r = await pedirCodigoAssinatura(contratoId);
      if (!r.ok) {
        setErro(r.error ?? "Não foi possível enviar o código.");
        // A página pode não saber que faltam as instruções (mudaram depois de abrir): relê, para o motivo e o caminho
        // ficarem certos e saírem sozinhos quando o proprietário as preencher.
        if (r.error === MSG_FALTAM_INSTRUCOES) router.refresh();
        return;
      }
      setEnviado(true);
    } catch {
      // E654: falha na chamada ao servidor (rede, versão nova no ar): nunca "gira e volta" calado.
      setErro("Não foi possível enviar o código agora. Recarregue a página e tente de novo.");
    } finally {
      setPedindo(false);
    }
  }

  async function assinar(e: React.FormEvent) {
    e.preventDefault();
    // E675: um envio por vez (o botão desabilita, mas o toque duplo chega antes do re-render).
    if (enviando) return;
    setErroAssinar(null);
    setEnviando(true);
    try {
      const r = await assinarContrato({ contratoId, aceite, codigo });
      if (!r.ok) {
        setErroAssinar(r.error ?? "Não foi possível assinar.");
        // A assinatura pode ter entrado (outro envio, outra aba): relê o contrato; se estiver assinado, o formulário some.
        router.refresh();
        return;
      }
      setAssinado(true);
      if (r.aviso) window.dispatchEvent(new CustomEvent(EVENTO_AVISO_ASSINATURA, { detail: { contratoId, aviso: r.aviso } }));
      try {
        window.sessionStorage.removeItem(chave);
      } catch {
        /* sem armazenamento */
      }
      // Prompt 61-A: a segunda assinatura leva à tela "Estadia confirmada" (uma vez; depois, pela página da estadia).
      if (r.ambos) {
        router.push(HREF_CONFIRMADA(contratoId));
        return;
      }
      router.refresh();
    } catch {
      // E675: falha na chamada (rede, versão nova no ar) depois de a assinatura poder ter sido gravada: nunca tela muda.
      setErroAssinar("Não conseguimos confirmar a resposta agora. Atualize a página: se a assinatura foi registrada, ela aparece no contrato.");
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  if (assinado) return null;

  // E1065: o motivo que a página já conhece (antes do clique) e a recusa do clique ocupam o MESMO lugar, junto do botão.
  const pendencia = faltamInstrucoes && !enviado && !erro;
  const caminhoDasInstrucoes = pendencia || erro === MSG_FALTAM_INSTRUCOES;

  return (
    <form onSubmit={assinar} className="mt-4 space-y-3 border-t border-line pt-4" data-testid="form-assinar">
      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={aceite}
          onChange={(e) => setAceite(e.target.checked)}
          className="mt-1 h-4 w-4"
          data-testid="assinar-aceite"
        />
        Li e concordo com o contrato acima.
      </label>
      <div>
        <div data-testid="assinar-pedir-area">
          <p className="text-sm font-medium text-ink">Confirme que é você</p>
          <Button type="button" variant="outline" onClick={pedir} disabled={pedindo} className="mt-1" data-testid="assinar-pedir-codigo">
            {pedindo ? <Loader2 className="h-4 w-4 animate-spin" /> : enviado ? "Enviar outro código" : "Enviar código por e-mail"}
          </Button>
          {erro ? (
            <p role="alert" className="mt-2 text-sm text-red-700" data-testid="assinar-pedir-erro">
              {erro}
            </p>
          ) : pendencia ? (
            <p role="status" className="mt-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800" data-testid="assinar-pedir-pendencia">
              {MSG_FALTAM_INSTRUCOES}
            </p>
          ) : null}
          {caminhoDasInstrucoes && (
            <a href="#checkin-painel" className="inline-flex min-h-11 items-center text-sm font-semibold text-forest underline">
              Preencher as instruções de entrada
            </a>
          )}
          {enviado && <p className="mt-1 text-xs text-muted" data-testid="assinar-codigo-enviado">Enviamos 6 números para o e-mail da sua conta. Valem por 15 minutos.</p>}
        </div>
        <label htmlFor="assinar-codigo" className="mt-3 block text-sm font-medium text-ink">
          Código recebido por e-mail
        </label>
        <input
          id="assinar-codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
          className="mt-1 w-full max-w-[12rem] rounded-xl border border-line bg-white px-3 py-3 text-base tracking-widest"
          data-testid="assinar-codigo"
        />
      </div>
      {erroAssinar && (
        <p role="alert" className="text-sm text-red-700" data-testid="assinar-erro">
          {erroAssinar}
        </p>
      )}
      <Button type="submit" variant="gold" disabled={!aceite || codigo.length !== 6 || enviando} data-testid="assinar-enviar">
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assinar contrato"}
      </Button>
    </form>
  );
}
