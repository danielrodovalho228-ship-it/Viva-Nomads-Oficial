"use client";

import { BlocoOpcional } from "@/components/anuncio/bloco-opcional";
import { CartaoEscolha, EscolhaUnica } from "@/components/anuncio/escolha-assistente";
import { AREAS_CONDOMINIO, GRUPOS_DETALHE, ITENS_INCLUIDOS, MAX_ANDAR, MAX_OBS_VAGA, type ChaveGrupoDetalhe } from "@/lib/anuncio/detalhes-anuncio";
import { tipoSemAndar } from "@/lib/anuncio/chacara";
import { desligarGrupo, grupoTemDados, type DetalhesForm } from "@/lib/anuncio/detalhes-form";

export { estadosDetalhes, formDeDetalhes, payloadDeDetalhes, type DetalhesForm } from "@/lib/anuncio/detalhes-form";

// E193: o campo (texto, data, número) tem a moldura, o tamanho e o estado do cartão grande do assistente.
const campo = "w-full min-h-14 rounded-xl border-2 border-line bg-white px-4 text-sm text-ink outline-none transition-colors hover:border-sage focus:border-forest";

/** E193: várias escolhas no cartão grande, em grade (antes, caixa quadrada dentro de pílula). */
function Marcas({ nome, itens, valor, onChange }: { nome: string; itens: readonly { chave: string; rotulo: string }[]; valor: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {itens.map((i) => (
        <CartaoEscolha
          key={i.chave}
          papel="checkbox"
          on={valor.includes(i.chave)}
          onClick={() => onChange(valor.includes(i.chave) ? valor.filter((c) => c !== i.chave) : [...valor, i.chave])}
          testid={`${nome}-${i.chave}`}
          rotulo={<span className="first-letter:uppercase">{i.rotulo}</span>}
        />
      ))}
    </div>
  );
}

function Radios<T extends string>({ nome, legenda, opcoes, valor, onChange }: { nome: string; legenda: string; opcoes: { valor: T; rotulo: string }[]; valor: T | ""; onChange: (v: T | "") => void }) {
  return <EscolhaUnica<T | ""> testid={nome} legenda={legenda} valor={valor} onChange={onChange} opcoes={[{ valor: "", rotulo: "Não informar" }, ...opcoes]} />;
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
