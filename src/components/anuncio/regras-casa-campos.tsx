"use client";

import { BlocoOpcional } from "@/components/anuncio/bloco-opcional";
import { MAX_OUTRAS_REGRAS, OPCOES_FESTAS, OPCOES_FUMO } from "@/lib/anuncio/regras-casa";
import { REGRAS_CONVIVENCIA, desligarRegra, regraTemDados, type RegraConvivencia, type RegrasCasaForm } from "@/lib/anuncio/regras-casa-form";

export { estadosConvivencia, formDeRegrasCasa, payloadDeRegrasCasa, type RegrasCasaForm } from "@/lib/anuncio/regras-casa-form";

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
  onChange: (v: T) => void;
}) {
  return (
    <fieldset data-testid={`regras-casa-${nome}`}>
      <legend className="text-sm font-semibold text-ink">{legenda}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <label key={o.valor} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line px-4 text-sm">
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

/**
 * Convivência no desenho da tela 06 dos mockups aprovados: cada regra (silêncio, fumo, festas, visitas) num bloco
 * opcional próprio (padrão E56). Desligada = não definida, não aparece no anúncio.
 */
export function RegrasCasaCampos({ value, onChange }: { value: RegrasCasaForm; onChange: (v: RegrasCasaForm) => void }) {
  const muda = (p: Partial<RegrasCasaForm>) => onChange({ ...value, ...p });
  const silencioIncompleto = (value.silencioInicio === "") !== (value.silencioFim === "");
  const conteudo: Record<RegraConvivencia, React.ReactNode> = {
    silencio: (
      <>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs text-muted">
            Das
            <input type="time" className={campo} value={value.silencioInicio} onChange={(e) => muda({ silencioInicio: e.target.value })} data-testid="regras-casa-silencio-inicio" />
          </label>
          <label className="grid gap-1 text-xs text-muted">
            Até
            <input type="time" className={campo} value={value.silencioFim} onChange={(e) => muda({ silencioFim: e.target.value })} data-testid="regras-casa-silencio-fim" />
          </label>
        </div>
        {silencioIncompleto && <p className="text-xs text-muted">Preencha o início e o fim para o horário aparecer no anúncio.</p>}
      </>
    ),
    fumo: <Escolha nome="fumo" legenda="Fumar no imóvel" opcoes={OPCOES_FUMO} valor={value.fumo} onChange={(fumo) => muda({ fumo })} />,
    festas: <Escolha nome="festas" legenda="Festas e eventos" opcoes={OPCOES_FESTAS} valor={value.festas} onChange={(festas) => muda({ festas })} />,
    visitas: (
      <>
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
      </>
    ),
  };
  return (
    <div className="grid gap-3" data-testid="regras-casa">
      <div>
        <h3 className="text-sm font-semibold text-ink">Convivência</h3>
        <p className="mt-1 text-xs text-muted">Ligue só as regras que valem na sua casa. O que ficar desligado não aparece no anúncio.</p>
      </div>
      {REGRAS_CONVIVENCIA.map(({ chave, titulo, descricao }) => (
        <BlocoOpcional
          key={chave}
          id={chave}
          titulo={titulo}
          descricao={descricao}
          ligado={value.ligados[chave]}
          temDados={regraTemDados(value, chave)}
          onLigar={() => onChange({ ...value, ligados: { ...value.ligados, [chave]: true } })}
          onDesligar={() => onChange(desligarRegra(value, chave))}
        >
          {conteudo[chave]}
        </BlocoOpcional>
      ))}
      <label className="grid gap-1 text-sm font-semibold text-ink">
        Outras regras (opcional)
        <textarea
          className="min-h-[88px] w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal text-ink"
          value={value.outras}
          maxLength={MAX_OUTRAS_REGRAS}
          placeholder="Ex.: tirar os sapatos na sala, manter a varanda limpa"
          onChange={(e) => muda({ outras: e.target.value })}
          data-testid="regras-casa-outras"
        />
        <span className="text-xs font-normal text-muted" data-testid="regras-casa-outras-contador">
          {value.outras.length} de {MAX_OUTRAS_REGRAS} caracteres
        </span>
      </label>
    </div>
  );
}
