"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonClasses } from "@/components/ui/button";
import { DangerZone } from "@/components/account/conta-secoes";
import { aceitarAjudaSaida, estadoSaida, pausarConta, reativarConta, registrarMotivoSaida } from "@/lib/saida/acoes";
import { MOTIVOS_DE_VALOR, MOTIVOS_SAIDA, ROTULO_NIVEL_SAIDA, TEXTO_EXCLUSAO, VALORES_SURPRESA, type AjudaSaida, type NivelSaida, type PapelSaida, type PendenciaSaida } from "@/lib/saida/regras";

/*
  Prompt 51, fase 1 — "Sair da Viva". Sem dark pattern: os 3 cartões têm o mesmo peso; o motivo é opcional ("Continuar
  sem responder" com a mesma classe); a ajuda nunca bloqueia ("Seguir com a saída" com a mesma classe); pausar nunca é
  bloqueado por pendência. Os botões de saída usam a mesma variante dos outros (nunca menores nem apagados).
*/
type Etapa = "escolha" | "motivo" | "ajuda" | NivelSaida;
type Estado = { papel: PapelSaida; pausadaEm: string | null; pendencias: PendenciaSaida[] };

const CARTOES: { nivel: NivelSaida; texto: string; botao: string }[] = [
  { nivel: "pausar", texto: "Seus anúncios e sua página saem da busca e os avisos param. O que está em andamento continua. Volte quando quiser, com um toque.", botao: "Pausar a conta" },
  { nivel: "apagar", texto: TEXTO_EXCLUSAO, botao: "Apagar meus dados" },
  { nivel: "encerrar", texto: "Veja o que ainda está em aberto (contrato, pedido de parceiro, caução) e resolva cada um no lugar certo.", botao: "Ver as pendências" },
];
const CLASSE_BOTAO = buttonClasses({ variant: "outline", size: "md" });

export function SairDaViva() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("escolha");
  const [nivel, setNivel] = useState<NivelSaida>("pausar");
  const [motivo, setMotivo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [texto, setTexto] = useState("");
  const [ajuda, setAjuda] = useState<{ id: string | null; ajuda: AjudaSaida } | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    let vivo = true;
    estadoSaida()
      .then((e) => vivo && setEstado(e))
      .catch(() => null);
    return () => {
      vivo = false;
    };
  }, []);

  const escolher = (n: NivelSaida) => {
    setNivel(n);
    setAviso(null);
    setEtapa("motivo");
  };

  const continuar = (comMotivo: boolean) =>
    iniciar(async () => {
      const f = new FormData();
      f.set("nivel", nivel);
      if (comMotivo) {
        f.set("motivo", motivo);
        f.set("detalhe", detalhe);
        f.set("texto", texto);
      }
      const r = await registrarMotivoSaida(f).catch(() => null);
      if (r?.ok && r.ajuda) {
        setAjuda({ id: r.id, ajuda: r.ajuda });
        setEtapa("ajuda");
      } else setEtapa(nivel);
    });

  const papel = estado?.papel ?? "morador";

  return (
    <div className="mt-6 space-y-4" data-testid="sair-da-viva" data-etapa={etapa}>
      {estado?.pausadaEm && etapa === "escolha" && <ContaPausada aoReativar={(e) => setEstado(e)} />}

      {etapa === "escolha" && (
        <ul className="grid gap-4 md:grid-cols-3" data-testid="saida-cartoes">
          {CARTOES.map((c) => (
            <li key={c.nivel} className="flex flex-col rounded-xl border border-line p-4" data-testid={`saida-cartao-${c.nivel}`}>
              <h3 className="font-title text-lg font-semibold text-ink">{ROTULO_NIVEL_SAIDA[c.nivel]}</h3>
              <p className="mt-2 flex-1 text-sm text-muted">{c.texto}</p>
              <button type="button" className={`mt-4 ${CLASSE_BOTAO}`} onClick={() => escolher(c.nivel)} data-testid={`saida-escolher-${c.nivel}`}>
                {c.botao}
              </button>
            </li>
          ))}
        </ul>
      )}

      {etapa === "motivo" && (
        <div className="rounded-xl border border-line p-4" data-testid="saida-motivo">
          <p className="font-semibold text-ink">Antes de seguir: quer contar por que está saindo?</p>
          <p className="mt-1 text-sm text-muted">É opcional. Ajuda a Viva a melhorar.</p>
          <fieldset className="mt-3 grid gap-2">
            <legend className="sr-only">Motivo</legend>
            {MOTIVOS_SAIDA[papel].map((m) => (
              <label key={m.chave} className="flex min-h-11 items-center gap-3 text-sm text-ink">
                <input type="radio" name="motivo" value={m.chave} checked={motivo === m.chave} onChange={() => setMotivo(m.chave)} className="h-5 w-5 accent-forest" />
                {m.rotulo}
              </label>
            ))}
          </fieldset>
          {MOTIVOS_DE_VALOR.has(motivo) && (
            <label className="mt-3 block text-sm text-ink">
              Qual valor surpreendeu? (opcional)
              <select value={detalhe} onChange={(e) => setDetalhe(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-base">
                <option value="">Prefiro não dizer</option>
                {VALORES_SURPRESA.map((v) => (
                  <option key={v.chave} value={v.chave}>{v.rotulo}</option>
                ))}
              </select>
            </label>
          )}
          <label className="mt-3 block text-sm text-ink">
            Quer contar mais? (opcional — lido por uma pessoa)
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-base" />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className={CLASSE_BOTAO} disabled={pendente} onClick={() => continuar(true)} data-testid="saida-continuar">
              Continuar
            </button>
            <button type="button" className={CLASSE_BOTAO} disabled={pendente} onClick={() => continuar(false)} data-testid="saida-sem-responder">
              Continuar sem responder
            </button>
          </div>
        </div>
      )}

      {etapa === "ajuda" && ajuda && (
        <div className="rounded-xl border border-line p-4" data-testid="saida-ajuda">
          <p className="text-ink">Talvez a gente resolva isso agora. Se preferir, siga com a saída: as duas opções estão aqui.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={ajuda.ajuda.href}
              className={CLASSE_BOTAO}
              onClick={() => {
                if (ajuda.id) void aceitarAjudaSaida(ajuda.id);
              }}
              data-testid="saida-aceitar-ajuda"
            >
              {ajuda.ajuda.rotulo}
            </Link>
            <button type="button" className={CLASSE_BOTAO} onClick={() => setEtapa(nivel)} data-testid="saida-seguir">
              Seguir com a saída
            </button>
          </div>
        </div>
      )}

      {etapa === "pausar" && (
        <div className="rounded-xl border border-line p-4" data-testid="saida-pausar">
          {estado?.pausadaEm ? (
            <ContaPausada aoReativar={(e) => setEstado(e)} />
          ) : (
            <>
              <p className="text-ink">Ao pausar: seus anúncios e sua página de parceiro saem da busca, e alertas e lembretes param. Contratos em vigência não mudam, e os avisos de contrato e de segurança continuam.</p>
              <Button
                variant="outline"
                className="mt-4"
                disabled={pendente}
                data-testid="saida-confirmar-pausa"
                onClick={() =>
                  iniciar(async () => {
                    const r = await pausarConta();
                    setAviso(r.ok ? { ok: true, texto: r.mensagem ?? "Conta pausada." } : { ok: false, texto: r.erro });
                    if (r.ok) setEstado(await estadoSaida());
                  })
                }
              >
                Pausar minha conta
              </Button>
            </>
          )}
        </div>
      )}

      {etapa === "encerrar" && (
        <div className="rounded-xl border border-line p-4" data-testid="saida-pendencias">
          {estado && estado.pendencias.length > 0 ? (
            <>
              <p className="text-ink">Estas pendências continuam valendo. Resolva cada uma no lugar certo:</p>
              <ul className="mt-3 grid gap-2">
                {estado.pendencias.map((p) => (
                  <li key={p.href} className="flex flex-wrap items-center justify-between gap-2 text-sm" data-testid="saida-pendencia" data-tipo={p.tipo}>
                    <span className="text-ink">{p.texto}</span>
                    <Link href={p.href} className="font-semibold text-forest underline underline-offset-4">{p.rotuloAcao}</Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-ink" data-testid="saida-sem-pendencias">Você não tem pendências. Se quiser, pode apagar seus dados.</p>
          )}
          <button type="button" className={`mt-4 ${CLASSE_BOTAO}`} onClick={() => setEtapa("apagar")} data-testid="saida-ir-apagar">
            Apagar meus dados
          </button>
        </div>
      )}

      {etapa === "apagar" && <DangerZone />}

      {aviso && (
        <p role={aviso.ok ? "status" : "alert"} className={aviso.ok ? "text-sm text-ink" : "text-sm text-red-700"} data-testid="saida-aviso">
          {aviso.texto}
        </p>
      )}
      {etapa !== "escolha" && (
        <Button variant="tertiary" onClick={() => setEtapa("escolha")} data-testid="saida-voltar">
          Voltar às opções
        </Button>
      )}
    </div>
  );
}

/** Conta pausada: "Reativar minha conta" em um toque (também no topo do painel). */
export function ContaPausada({ aoReativar }: { aoReativar?: (e: Estado | null) => void }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 p-4" data-testid="conta-pausada">
      <p className="text-sm text-ink">Sua conta está pausada: seus anúncios e sua página não aparecem na busca e os avisos estão parados.</p>
      <Button
        variant="primary"
        disabled={pendente}
        data-testid="reativar-conta"
        onClick={() =>
          iniciar(async () => {
            const r = await reativarConta();
            if (!r.ok) setErro(r.erro);
            else if (aoReativar) aoReativar(await estadoSaida());
            else router.refresh();
          })
        }
      >
        Reativar minha conta
      </Button>
      {erro && <p role="alert" className="w-full text-sm text-red-700">{erro}</p>}
    </div>
  );
}
