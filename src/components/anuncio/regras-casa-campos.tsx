"use client";

import { OPCOES_FESTAS, OPCOES_FUMO, type Festas, type Fumo, type RegrasCasa } from "@/lib/anuncio/regras-casa";

/** Rascunho do formulário: "" = não definido (não aparece no anúncio). O servidor valida de novo. */
export interface RegrasCasaForm {
  silencioInicio: string;
  silencioFim: string;
  fumo: "" | Fumo;
  festas: "" | Festas;
  visitas: "" | "sim" | "nao";
  visitasAte: string;
  pernoite: "" | "sim" | "nao";
}

const simNao = (v: boolean | undefined): "" | "sim" | "nao" => (v === undefined ? "" : v ? "sim" : "nao");

export function formDeRegrasCasa(r?: RegrasCasa): RegrasCasaForm {
  return {
    silencioInicio: r?.silencio?.inicio ?? "",
    silencioFim: r?.silencio?.fim ?? "",
    fumo: r?.fumo ?? "",
    festas: r?.festas ?? "",
    visitas: simNao(r?.visitas?.permitidas),
    visitasAte: r?.visitas?.ate ?? "",
    pernoite: simNao(r?.visitas?.pernoite),
  };
}

/** O que vai ao servidor; campos vazios simplesmente não vão. */
export function payloadDeRegrasCasa(f: RegrasCasaForm): RegrasCasa {
  const r: RegrasCasa = {};
  if (f.silencioInicio && f.silencioFim) r.silencio = { inicio: f.silencioInicio, fim: f.silencioFim };
  if (f.fumo) r.fumo = f.fumo;
  if (f.festas) r.festas = f.festas;
  if (f.visitas === "nao") r.visitas = { permitidas: false };
  if (f.visitas === "sim")
    r.visitas = {
      permitidas: true,
      ...(f.visitasAte ? { ate: f.visitasAte } : {}),
      ...(f.pernoite ? { pernoite: f.pernoite === "sim" } : {}),
    };
  return r;
}

const campo = "w-full min-h-[44px] rounded-lg border border-line bg-white px-3 text-sm text-ink";

function Escolha<T extends string>({
  nome,
  legenda,
  opcoes,
  valor,
  onChange,
}: {
  nome: string;
  legenda: string;
  opcoes: readonly { valor: T; rotulo: string }[];
  valor: "" | T;
  onChange: (v: "" | T) => void;
}) {
  return (
    <fieldset data-testid={`regras-casa-${nome}`}>
      <legend className="text-sm font-semibold text-ink">{legenda}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {[{ valor: "" as const, rotulo: "Não definido" }, ...opcoes].map((o) => (
          <label key={o.valor || "nd"} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line px-4 text-sm">
            <input type="radio" name={`regras-casa-${nome}`} value={o.valor} checked={valor === o.valor} onChange={() => onChange(o.valor)} />
            {o.rotulo}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const SIM_NAO = [
  { valor: "sim", rotulo: "Sim" },
  { valor: "nao", rotulo: "Não" },
] as const;

export function RegrasCasaCampos({ value, onChange }: { value: RegrasCasaForm; onChange: (v: RegrasCasaForm) => void }) {
  const muda = (p: Partial<RegrasCasaForm>) => onChange({ ...value, ...p });
  const silencioIncompleto = (value.silencioInicio === "") !== (value.silencioFim === "");
  return (
    <div className="grid gap-4 rounded-xl border border-line bg-white p-4" data-testid="regras-casa">
      <div>
        <h3 className="text-sm font-semibold text-ink">Convivência</h3>
        <p className="mt-1 text-xs text-muted">Opcional. O que você definir aparece em “Regras da casa” no anúncio; o que ficar sem definir não aparece.</p>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold text-ink">Horário de silêncio</legend>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs text-muted">
            Das
            <input type="time" className={campo} value={value.silencioInicio} onChange={(e) => muda({ silencioInicio: e.target.value })} data-testid="regras-casa-silencio-inicio" />
          </label>
          <label className="grid gap-1 text-xs text-muted">
            Até
            <input type="time" className={campo} value={value.silencioFim} onChange={(e) => muda({ silencioFim: e.target.value })} data-testid="regras-casa-silencio-fim" />
          </label>
        </div>
        {silencioIncompleto && <p className="mt-1 text-xs text-muted">Preencha o início e o fim para o horário aparecer no anúncio.</p>}
      </fieldset>
      <Escolha nome="fumo" legenda="Fumar" opcoes={OPCOES_FUMO} valor={value.fumo} onChange={(fumo) => muda({ fumo })} />
      <Escolha nome="festas" legenda="Festas e eventos" opcoes={OPCOES_FESTAS} valor={value.festas} onChange={(festas) => muda({ festas })} />
      <Escolha
        nome="visitas"
        legenda="Visitas permitidas?"
        opcoes={SIM_NAO}
        valor={value.visitas}
        onChange={(visitas) => muda(visitas === "sim" ? { visitas } : { visitas, visitasAte: "", pernoite: "" })}
      />
      {value.visitas === "sim" && (
        <>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Visitas até que horas (opcional)
            <input type="time" className={campo} value={value.visitasAte} onChange={(e) => muda({ visitasAte: e.target.value })} data-testid="regras-casa-visitas-ate" />
          </label>
          <Escolha nome="pernoite" legenda="A visita pode pernoitar?" opcoes={SIM_NAO} valor={value.pernoite} onChange={(pernoite) => muda({ pernoite })} />
        </>
      )}
    </div>
  );
}
