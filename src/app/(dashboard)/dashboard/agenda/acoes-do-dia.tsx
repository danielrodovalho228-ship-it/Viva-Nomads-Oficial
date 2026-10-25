"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmarNaPagina } from "@/components/ui/confirmar-na-pagina";
import { addBlock, removeBlock } from "@/lib/data/blocks-actions";
import { responderVisita, type AcaoVisita } from "@/lib/data/visitas-video-actions";
import { acaoDoDia, conflitoComEstadia, type EstadoDoDia, type ItemAgenda } from "@/lib/agenda";
import {
  CONFIRMAR_ATE_DIAS,
  ROTULO_FUSO,
  campoBrasiliaParaIso,
  formatarHorario,
  formatarHorarioBrasilia,
  instanteParaCampoBrasilia,
} from "@/lib/visitas-video";

/*
  AGENDA-A (E83), itens 2 e 4 — o que dá para fazer no dia aberto. Bloquear e desbloquear usam as MESMAS ações do
  calendário da edição do anúncio (addBlock/removeBlock); as visitas, a MESMA ação de /dashboard/visitas
  (responderVisita). A confirmação é na página (ConfirmarNaPagina), nunca do navegador.
*/

function brData(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

function Erro({ msg }: { msg: string | null }) {
  return msg ? (
    <p role="alert" data-testid="agenda-acao-erro" className="mt-2 text-sm text-red-600">
      {msg}
    </p>
  ) : null;
}

/** Ações do dia sem visita: bloquear (dia ou período), desbloquear, estadia (não bloqueia), escolher o imóvel. */
export function AcoesDoDia({
  dia,
  hoje,
  estado,
  imovel,
  itensDoImovel,
}: {
  dia: string;
  hoje: string;
  estado: EstadoDoDia;
  /** Imóvel escolhido no filtro (null = todos). */
  imovel: string | null;
  /** Todos os itens do imóvel escolhido (para não deixar o período encostar numa estadia). */
  itensDoImovel: ItemAgenda[];
}) {
  const router = useRouter();
  const [periodo, setPeriodo] = useState(false);
  const [ate, setAte] = useState(dia);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const acao = acaoDoDia(estado, dia, hoje, !!imovel);

  async function bloquear(fim: string) {
    if (!imovel) return;
    setErro(null);
    if (fim < dia) return setErro("O fim do período não pode ser antes do início.");
    const choque = conflitoComEstadia(itensDoImovel, imovel, dia, fim);
    if (choque) return setErro(`Não dá para bloquear: ${brData(choque)} já tem estadia com contrato.`);
    setOcupado(true);
    const r = await addBlock(imovel, dia, fim).catch(() => null);
    setOcupado(false);
    if (!r?.ok) return setErro(r?.error ?? "Não foi possível bloquear agora. Tente de novo.");
    setPeriodo(false);
    router.refresh();
  }

  async function desbloquear(item: ItemAgenda) {
    setErro(null);
    const r = await removeBlock(item.id.replace(/^bloqueio-/, "")).catch(() => null);
    if (!r?.ok) return setErro(r?.error ?? "Não foi possível desbloquear agora. Tente de novo.");
    router.refresh();
  }

  if (acao === "estadia") {
    return (
      <div className="mt-2 space-y-1" data-testid="agenda-dia-estadia">
        {estado.estadias.map(({ item }) => (
          <p key={item.id} className="text-sm text-ink">
            Estadia{item.pessoa ? ` de ${item.pessoa.nome}` : ""}
            {item.href && (
              <>
                {" · "}
                <Link href={item.href} className="font-semibold text-forest underline underline-offset-4" data-testid="agenda-ver-contrato">
                  ver contrato
                </Link>
              </>
            )}
          </p>
        ))}
        <p className="text-xs text-muted">Dia com estadia não pode ser bloqueado.</p>
      </div>
    );
  }

  if (acao === "escolher-imovel") {
    return (
      <p className="mt-2 text-sm text-muted" data-testid="agenda-dia-escolher">
        {estado.bloqueios.length ? "Data bloqueada. " : "Dia livre. "}
        Escolha um imóvel no filtro acima para bloquear ou desbloquear datas.
      </p>
    );
  }

  if (acao === "desbloquear") {
    return (
      <div className="mt-2 space-y-2" data-testid="agenda-dia-bloqueado">
        {estado.bloqueios.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center gap-3">
            <p className="flex items-center gap-2 text-sm text-ink">
              <Ban className="h-4 w-4 text-muted" aria-hidden />
              Bloqueado{b.ate && b.ate !== b.quando ? ` de ${brData(b.quando)} a ${brData(b.ate)}` : ""}
            </p>
            {b.origem === "importado" ? (
              <span className="text-xs text-muted" data-testid="agenda-bloqueio-importado">
                Importado do calendário de outro site (sai daqui quando sair de lá)
              </span>
            ) : (
              <ConfirmarNaPagina
                aviso={b.ate && b.ate !== b.quando ? `Desbloquear todo o período de ${brData(b.quando)} a ${brData(b.ate)}?` : `Desbloquear ${brData(b.quando)}?`}
                confirmar="Desbloquear"
                onConfirmar={() => desbloquear(b)}
                size="sm"
                testid="agenda-desbloquear"
              >
                Desbloquear
              </ConfirmarNaPagina>
            )}
          </div>
        ))}
        <Erro msg={erro} />
      </div>
    );
  }

  if (acao === "passado") {
    return (
      <p className="mt-2 text-sm text-muted" data-testid="agenda-dia-passado">
        Dia livre, já passou.
      </p>
    );
  }

  return (
    <div className="mt-2" data-testid="agenda-dia-livre">
      <p className="text-sm text-muted">Dia livre.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={ocupado} onClick={() => void bloquear(dia)} data-testid="agenda-bloquear-dia">
          Bloquear este dia
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={ocupado} onClick={() => setPeriodo((v) => !v)} data-testid="agenda-bloquear-periodo">
          Bloquear um período
        </Button>
      </div>
      {periodo && (
        <div className="mt-3 flex flex-wrap items-end gap-2" data-testid="agenda-periodo">
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
            Até (último dia bloqueado)
            <input
              type="date"
              min={dia}
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              data-testid="agenda-periodo-ate"
              className="h-11 rounded-lg border border-line bg-white px-3 text-base text-ink"
            />
          </label>
          <Button type="button" variant="secondary" size="sm" disabled={ocupado || !ate} onClick={() => void bloquear(ate)} data-testid="agenda-periodo-bloquear">
            Bloquear de {brData(dia)} a {ate ? brData(ate) : "…"}
          </Button>
        </div>
      )}
      <Erro msg={erro} />
    </div>
  );
}

/**
 * Ações da visita (item 4): pendente → Confirmar / Propor outro horário; confirmada → Remarcar / Cancelar. Mesma ação
 * de /dashboard/visitas, mesmas regras (horário em até 14 dias, link da chamada no vídeo).
 */
export function AcoesDaVisita({ i }: { i: ItemAgenda }) {
  const router = useRouter();
  const v = i.visita;
  const video = i.modalidade !== "presencial";
  const [modo, setModo] = useState<"confirmar" | "propor" | null>(null);
  const [horario, setHorario] = useState(v?.horarios[0] ?? "");
  const [outro, setOutro] = useState("");
  const [link, setLink] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [{ min, max }] = useState(() => {
    const agora = new Date();
    return { min: instanteParaCampoBrasilia(agora), max: instanteParaCampoBrasilia(new Date(agora.getTime() + CONFIRMAR_ATE_DIAS * 24 * 3600_000)) };
  });
  if (!v) return null;

  async function rodar(acao: AcaoVisita) {
    setErro(null);
    setOcupado(true);
    const r = await responderVisita(acao).catch(() => null);
    setOcupado(false);
    if (!r?.ok) return setErro(r?.error ?? "Não foi possível agora. Tente de novo.");
    setModo(null);
    router.refresh();
  }

  const campoLink = video && (
    <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
      Link da chamada (Meet, Zoom, Teams ou chamada do WhatsApp)
      <input
        type="url"
        inputMode="url"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="https://meet.google.com/..."
        data-testid="agenda-visita-link"
        className="h-11 w-full rounded-lg border border-line bg-white px-3 text-base text-ink"
      />
    </label>
  );
  const outroIso = outro ? campoBrasiliaParaIso(outro) : null;
  const campoOutro = (
    <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
      Novo horário ({ROTULO_FUSO})
      <input
        type="datetime-local"
        min={min}
        max={max}
        value={outro}
        onChange={(e) => setOutro(e.target.value)}
        data-testid="agenda-visita-outro-horario"
        className="h-11 w-full rounded-lg border border-line bg-white px-3 text-base text-ink"
      />
    </label>
  );

  return (
    <div className="mt-2 pl-12" data-testid="agenda-visita-acoes" data-status={i.status}>
      {i.status === "pedido" && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={ocupado} aria-pressed={modo === "confirmar"} onClick={() => setModo(modo === "confirmar" ? null : "confirmar")} data-testid="agenda-visita-confirmar">
            Confirmar
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={ocupado} aria-pressed={modo === "propor"} onClick={() => setModo(modo === "propor" ? null : "propor")} data-testid="agenda-visita-propor">
            Propor outro horário
          </Button>
        </div>
      )}
      {i.status === "remarcar" && v.horarioProposto && (
        <p className="flex items-center gap-2 text-sm text-ink" data-testid="agenda-visita-proposta">
          <CalendarClock className="h-4 w-4 text-muted" aria-hidden />
          Você propôs {formatarHorarioBrasilia(v.horarioProposto)}. Aguardando o interessado aceitar.
        </p>
      )}
      {i.status === "confirmado" && (
        <div className="flex flex-wrap items-start gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={ocupado} aria-pressed={modo === "propor"} onClick={() => setModo(modo === "propor" ? null : "propor")} data-testid="agenda-visita-remarcar">
            Remarcar
          </Button>
          <ConfirmarNaPagina aviso="Cancelar esta visita? O interessado é avisado." confirmar="Cancelar visita" onConfirmar={() => rodar({ acao: "cancelar", id: v.id })} size="sm" variant="ghost" testid="agenda-visita-cancelar">
            Cancelar
          </ConfirmarNaPagina>
        </div>
      )}

      {modo === "confirmar" && (
        <div className="mt-3 flex flex-col gap-3" data-testid="agenda-visita-form-confirmar">
          {v.horarios.length > 1 && (
            <fieldset className="flex flex-col gap-1">
              <legend className="text-xs font-semibold text-ink">Horário ({ROTULO_FUSO})</legend>
              {v.horarios.map((h) => (
                <label key={h} className="flex min-h-11 items-center gap-2 text-sm text-ink">
                  <input type="radio" name={`ag-h-${v.id}`} checked={horario === h} onChange={() => setHorario(h)} />
                  {formatarHorario(h)}
                </label>
              ))}
            </fieldset>
          )}
          {v.horarios.length === 1 && <p className="text-sm text-ink">Horário pedido: {formatarHorario(v.horarios[0])}</p>}
          {campoLink}
          <div>
            <Button type="button" variant="secondary" size="sm" disabled={ocupado || !horario} onClick={() => void rodar({ acao: "confirmar", id: v.id, horario, link: video ? link : undefined })} data-testid="agenda-visita-confirmar-enviar">
              Confirmar visita
            </Button>
          </div>
        </div>
      )}
      {modo === "propor" && (
        <div className="mt-3 flex flex-col gap-3" data-testid="agenda-visita-form-propor">
          {campoOutro}
          {campoLink}
          <div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={ocupado || !outroIso}
              onClick={() => outroIso && void rodar({ acao: "remarcar", id: v.id, horario: outroIso, link: video ? link : undefined })}
              data-testid="agenda-visita-propor-enviar"
            >
              Enviar novo horário
            </Button>
          </div>
        </div>
      )}
      <Erro msg={erro} />
    </div>
  );
}
