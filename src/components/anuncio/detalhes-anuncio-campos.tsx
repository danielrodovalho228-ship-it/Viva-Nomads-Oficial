"use client";

import { BlocoOpcional } from "@/components/anuncio/bloco-opcional";
import { AREAS_CONDOMINIO, GRUPOS_DETALHE, ITENS_INCLUIDOS, MAX_ANDAR, MAX_OBS_VAGA, type ChaveGrupoDetalhe } from "@/lib/anuncio/detalhes-anuncio";
import { tipoSemAndar } from "@/lib/anuncio/chacara";
import { desligarGrupo, grupoTemDados, type DetalhesForm } from "@/lib/anuncio/detalhes-form";

export { estadosDetalhes, formDeDetalhes, payloadDeDetalhes, type DetalhesForm } from "@/lib/anuncio/detalhes-form";

const campo = "w-full min-h-[44px] rounded-lg border border-line bg-white px-3 text-sm text-ink";
const pilula = "inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line px-4 text-sm";

function Marcas({ nome, itens, valor, onChange }: { nome: string; itens: readonly { chave: string; rotulo: string }[]; valor: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {itens.map((i) => (
        <label key={i.chave} className={pilula}>
          <input
            type="checkbox"
            checked={valor.includes(i.chave)}
            onChange={(e) => onChange(e.target.checked ? [...valor, i.chave] : valor.filter((c) => c !== i.chave))}
            data-testid={`${nome}-${i.chave}`}
          />
          <span className="first-letter:uppercase">{i.rotulo}</span>
        </label>
      ))}
    </div>
  );
}

function Radios<T extends string>({ nome, legenda, opcoes, valor, onChange }: { nome: string; legenda: string; opcoes: { valor: T; rotulo: string }[]; valor: T | ""; onChange: (v: T | "") => void }) {
  return (
    <fieldset data-testid={nome}>
      <legend className="text-sm font-semibold text-ink">{legenda}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {[{ valor: "" as const, rotulo: "Não informar" }, ...opcoes].map((o) => (
          <label key={o.valor || "nd"} className={pilula}>
            <input type="radio" name={nome} checked={valor === o.valor} onChange={() => onChange(o.valor)} />
            {o.rotulo}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const SIM_NAO: { valor: "sim" | "nao"; rotulo: string }[] = [
  { valor: "sim", rotulo: "Sim" },
  { valor: "nao", rotulo: "Não" },
];

export function DetalhesAnuncioCampos({ value, onChange, tipo }: { value: DetalhesForm; onChange: (v: DetalhesForm) => void; /** TIPO-CHACARA-B: casa e chácara/sítio não têm andar nem elevador. */ tipo?: string | null }) {
  const muda = (p: Partial<DetalhesForm>) => onChange({ ...value, ...p });
  const bloco = (chave: ChaveGrupoDetalhe, conteudo: React.ReactNode) => {
    const g = GRUPOS_DETALHE.find((x) => x.chave === chave)!;
    return (
      <BlocoOpcional
        key={chave}
        id={chave}
        titulo={g.titulo}
        descricao={g.descricao}
        ligado={value.ligados[chave]}
        temDados={grupoTemDados(value, chave)}
        onLigar={() => onChange({ ...value, ligados: { ...value.ligados, [chave]: true } })}
        onDesligar={() => onChange(desligarGrupo(value, chave))}
      >
        {conteudo}
      </BlocoOpcional>
    );
  };
  return (
    <div className="grid gap-3" data-testid="detalhes-anuncio">
      {bloco("incluidoNoPreco", <Marcas nome="incluido" itens={ITENS_INCLUIDOS} valor={value.incluidoNoPreco} onChange={(incluidoNoPreco) => muda({ incluidoNoPreco })} />)}
      {bloco("areasCondominio", <Marcas nome="area" itens={AREAS_CONDOMINIO} valor={value.areasCondominio} onChange={(areasCondominio) => muda({ areasCondominio })} />)}
      {!tipoSemAndar(tipo) && bloco(
        "andar",
        <>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Andar (0 = térreo)
            <input type="number" min={0} max={MAX_ANDAR} inputMode="numeric" className={campo} value={value.andar} onChange={(e) => muda({ andar: e.target.value })} data-testid="detalhe-andar" />
          </label>
          <Radios nome="detalhe-elevador" legenda="O prédio tem elevador?" opcoes={SIM_NAO} valor={value.elevador} onChange={(elevador) => muda({ elevador })} />
        </>
      )}
      {bloco(
        "janela",
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Entrada a partir das
            <input type="time" className={campo} value={value.entradaDe} onChange={(e) => muda({ entradaDe: e.target.value })} data-testid="detalhe-entrada-de" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Entrada até às
            <input type="time" className={campo} value={value.entradaAte} onChange={(e) => muda({ entradaAte: e.target.value })} data-testid="detalhe-entrada-ate" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Saída até às
            <input type="time" className={campo} value={value.saidaAte} onChange={(e) => muda({ saidaAte: e.target.value })} data-testid="detalhe-saida-ate" />
          </label>
        </div>
      )}
      {bloco(
        "vaga",
        <>
          <Radios nome="detalhe-vaga-coberta" legenda="A vaga é coberta?" opcoes={SIM_NAO} valor={value.vagaCoberta} onChange={(vagaCoberta) => muda({ vagaCoberta })} />
          <Radios
            nome="detalhe-vaga-tipo"
            legenda="A vaga é fixa ou rotativa?"
            opcoes={[
              { valor: "fixa", rotulo: "Fixa" },
              { valor: "rotativa", rotulo: "Rotativa" },
            ]}
            valor={value.vagaTipo}
            onChange={(vagaTipo) => muda({ vagaTipo })}
          />
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Observação (opcional)
            <input className={campo} maxLength={MAX_OBS_VAGA} value={value.vagaObs} placeholder="Ex.: cabe carro médio; portão eletrônico" onChange={(e) => muda({ vagaObs: e.target.value })} data-testid="detalhe-vaga-obs" />
          </label>
        </>
      )}
    </div>
  );
}
