"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { ConfirmarNaPagina } from "@/components/ui/confirmar-na-pagina";
import type { AditivoView } from "@/lib/data/estadia";
import { assinarAditivo, listaParaPortaria, pedirCodigoAditivo, responderAditivo, salvarInstrucoes, salvarNota, type Res } from "@/lib/data/estadia-actions";
import { CAMPOS_INSTRUCOES, type Instrucoes } from "@/lib/estadia/instrucoes";
import type { PapelEstadia } from "@/lib/estadia/estadia";

const campo = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink";

function Mensagem({ erro, ok }: { erro: string | null; ok?: string | null }) {
  if (erro) {
    return (
      <p role="alert" className="text-sm font-semibold text-red-700" data-testid="estadia-erro">
        {erro}
      </p>
    );
  }
  return ok ? (
    <p role="status" className="text-sm text-forest" data-testid="estadia-ok">
      {ok}
    </p>
  ) : null;
}

const dataBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** Proposta de alteração aberta: responder (a outra parte) e assinar com código (as duas partes). */
export function AditivoPendente({ aditivo: a, papel }: { aditivo: AditivoView; papel: PapelEstadia }) {
  const router = useRouter();
  // "Ocupado" cobre só a ação. O refresh vai numa transição à parte: dentro da mesma transição, os botões
  // ficavam desabilitados até a página inteira renderizar de novo (t256: "Assinar aditivo" preso).
  const [pendente, setPendente] = useState(false);
  const [, iniciarRefresh] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [aceite, setAceite] = useState(false);
  // O que o servidor já confirmou nesta tela. O refresh da página pode ser descartado pelo roteador (o painel dispara
  // ações e prefetches ao mesmo tempo; t256), então o painel mostra o resultado confirmado sem esperar por ele.
  const [confirmado, setConfirmado] = useState<{ status?: string; taxaBase?: string | null; assinei?: boolean }>({});
  const status = maisAdiante(a.status, confirmado.status);
  const euAssinei = a.assinaturas.includes(papel) || confirmado.assinei === true;
  const taxaBase = a.taxa?.base ?? confirmado.taxaBase ?? null;

  const rodar = async <T,>(f: () => Promise<Res<T>>, msg: string, depois?: (v: T) => void, atualizar = true) => {
    setPendente(true);
    setErro(null);
    setOk(null);
    try {
      const r = await f();
      if (!r.ok) setErro(r.erro || "Não foi possível concluir.");
      else {
        depois?.(r.valor);
        setOk(msg);
        if (atualizar) iniciarRefresh(() => router.refresh());
      }
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setPendente(false);
    }
  };

  return (
    <Panel title={`Aditivo ${a.numero}: proposta de alteração`} data-testid="estadia-aditivo" data-status={status}>
      <p className="text-sm text-ink" data-testid="aditivo-resumo">{a.resumo}</p>
      {taxaBase && <p className="mt-1 text-xs text-muted" data-testid="aditivo-taxa">{taxaBase}</p>}
      <div className="mt-3 space-y-3">
        {status === "proposto" && a.propostoPorMim && (
          <p className="text-sm text-muted">Aguardando a resposta da outra parte até {dataBR(a.expiraEm)}. Nada muda no contrato antes do aceite e das duas assinaturas.</p>
        )}
        {status === "proposto" && !a.propostoPorMim && (
          <div className="flex flex-wrap items-center gap-3">
            {/* Um primário por tela (Prompt 41): o da estadia é "Mensagem"; responder e assinar ficam secundários. */}
            <Button variant="secondary" size="sm" disabled={pendente} onClick={() => rodar(() => responderAditivo(a.id, "aceitar"), "Proposta aceita. Agora as duas partes assinam o aditivo.", (v) => setConfirmado((c) => ({ ...c, status: "aceito", taxaBase: v.taxaBase })))} data-testid="aditivo-aceitar">
              Aceitar
            </Button>
            <ConfirmarNaPagina aviso="Recusar mantém o contrato como está." confirmar="Recusar" onConfirmar={() => rodar(() => responderAditivo(a.id, "recusar"), "Proposta recusada. O contrato continua como estava.", () => setConfirmado((c) => ({ ...c, status: "recusado" })))} size="sm" testid="aditivo-recusar">
              Recusar
            </ConfirmarNaPagina>
            <span className="text-xs text-muted">Responda até {dataBR(a.expiraEm)}.</span>
          </div>
        )}
        {status === "aceito" && euAssinei && <p className="text-sm text-muted">Você já assinou. Falta a assinatura da outra parte; os blocos e as datas mudam depois dela.</p>}
        {status === "aceito" && !euAssinei && (
          <div className="space-y-3">
            <p className="text-sm text-ink">Assine o aditivo com o código de 6 dígitos enviado ao seu e-mail (o mesmo fluxo da assinatura do contrato).</p>
            <Button variant="secondary" size="sm" disabled={pendente} onClick={() => rodar(() => pedirCodigoAditivo(a.id), "Código enviado para o seu e-mail.", undefined, false)} data-testid="aditivo-pedir-codigo">
              Enviar código por e-mail
            </Button>
            <label className="grid gap-1 text-sm font-semibold text-ink">
              Código
              <input className={campo} inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} data-testid="aditivo-codigo" />
            </label>
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-1" data-testid="aditivo-aceite" />
              Li o aditivo e concordo com o que muda. As demais condições do contrato continuam as mesmas.
            </label>
            <Button
              variant="secondary"
              size="sm"
              disabled={pendente || codigo.length !== 6 || !aceite}
              onClick={() => rodar(() => assinarAditivo(a.id, codigo, aceite), "Assinatura registrada.", (v) => setConfirmado((c) => ({ ...c, assinei: true, status: v.completo ? "assinado" : c.status })))}
              data-testid="aditivo-assinar"
            >
              Assinar aditivo
            </Button>
          </div>
        )}
        <Mensagem erro={erro} ok={ok} />
      </div>
    </Panel>
  );
}

/** Ordem do aditivo: o status confirmado nesta tela só avança, nunca volta para trás do que o servidor mandou. */
const ORDEM_ADITIVO = ["proposto", "aceito", "assinado"];
function maisAdiante(doServidor: string, confirmado?: string): string {
  if (!confirmado) return doServidor;
  if (confirmado === "recusado") return doServidor === "proposto" ? confirmado : doServidor;
  return ORDEM_ADITIVO.indexOf(confirmado) > ORDEM_ADITIVO.indexOf(doServidor) ? confirmado : doServidor;
}

/** Instruções de chegada: o dono preenche uma vez (valem para as próximas estadias do imóvel). */
export function EditorInstrucoes({ propertyId, contratoId, inicial, comoEntrarDoContrato = false }: { propertyId: string; contratoId?: string; inicial: Instrucoes; comoEntrarDoContrato?: boolean }) {
  const [valores, setValores] = useState<Instrucoes>(inicial);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  return (
    <form
      className="grid gap-3"
      data-testid="instrucoes-editor"
      onSubmit={(ev) => {
        ev.preventDefault();
        iniciar(async () => {
          setErro(null);
          setOk(null);
          const r = await salvarInstrucoes(propertyId, valores, contratoId);
          if (!r.ok) setErro(r.erro);
          else setOk("Instruções salvas. O morador vê 7 dias antes da entrada, com o contrato assinado e o 1º pagamento registrado.");
        });
      }}
    >
      <p className="text-sm text-muted">Só o morador com contrato assinado vê, 7 dias antes da entrada. Nunca aparece no anúncio.</p>
      {comoEntrarDoContrato && (
        <p className="text-sm text-ink" data-testid="instrucoes-como-entrar-do-contrato">
          &ldquo;Como entrar&rdquo; deste contrato vem da combinação de check-in. O que você escrever nele vale só para este contrato; os outros campos valem para o imóvel.
        </p>
      )}
      {CAMPOS_INSTRUCOES.map((c) => (
        <label key={c.chave} className="grid gap-1 text-sm font-semibold text-ink">
          {c.rotulo}
          {c.max > 100 ? (
            <textarea className={campo} rows={2} maxLength={c.max} value={valores[c.chave] ?? ""} onChange={(e) => setValores((v) => ({ ...v, [c.chave]: e.target.value }))} data-testid={`instrucoes-${c.chave}`} />
          ) : (
            <input className={campo} maxLength={c.max} value={valores[c.chave] ?? ""} onChange={(e) => setValores((v) => ({ ...v, [c.chave]: e.target.value }))} data-testid={`instrucoes-${c.chave}`} />
          )}
          {c.ajuda && <span className="text-xs font-normal text-muted">{c.ajuda}</span>}
        </label>
      ))}
      <div>
        <Button type="submit" variant="secondary" size="sm" disabled={pendente} data-testid="instrucoes-salvar">
          Salvar instruções
        </Button>
      </div>
      <Mensagem erro={erro} ok={ok} />
    </form>
  );
}

/** "Lista para a portaria": copiar ou baixar (nome + documento). */
export function ListaPortaria({ contratoId }: { contratoId: string }) {
  const [texto, setTexto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const abrir = () =>
    iniciar(async () => {
      const r = await listaParaPortaria(contratoId);
      if (!r.ok) setErro(r.erro);
      else setTexto(r.valor);
    });
  const baixar = () => {
    if (!texto) return;
    const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "lista-para-a-portaria.txt";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="w-full space-y-2">
      {!texto ? (
        <Button variant="secondary" size="sm" disabled={pendente} onClick={abrir} data-testid="lista-portaria-abrir">
          Lista para a portaria
        </Button>
      ) : (
        <>
          <textarea readOnly className={campo} rows={5} value={texto} data-testid="lista-portaria-texto" />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => void navigator.clipboard?.writeText(texto)} data-testid="lista-portaria-copiar">
              Copiar
            </Button>
            <Button variant="secondary" size="sm" onClick={baixar} data-testid="lista-portaria-baixar">
              Baixar
            </Button>
          </div>
        </>
      )}
      <Mensagem erro={erro} />
    </div>
  );
}

/** Nota privada: só quem escreveu lê (nem a outra parte, nem a Viva pela tela). */
export function NotasPrivadas({ contratoId, inicial }: { contratoId: string; inicial: string }) {
  const [texto, setTexto] = useState(inicial);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted">Só você vê estas notas.</p>
      <textarea className={campo} rows={4} maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)} data-testid="nota-texto" />
      <div>
        <Button
          variant="secondary"
          size="sm"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              setErro(null);
              setOk(null);
              const r = await salvarNota(contratoId, texto);
              if (!r.ok) setErro(r.erro);
              else setOk("Nota salva.");
            })
          }
          data-testid="nota-salvar"
        >
          Salvar nota
        </Button>
      </div>
      <Mensagem erro={erro} ok={ok} />
    </div>
  );
}
