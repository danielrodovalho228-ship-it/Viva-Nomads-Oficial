import { NOTA_ESTRUTURA_CONDOMINIO_GUIA, agruparInstrucoes, type Instrucoes } from "@/lib/estadia/instrucoes";

/** E661: as instruções liberadas do guia da estadia em blocos (chegada, imóvel, condomínio). Mesma tela para morador, dono e convidado. */
export function InstrucoesEmBlocos({ campos, testid }: { campos: Instrucoes | null | undefined; testid: string }) {
  const grupos = agruparInstrucoes(campos);
  return (
    <div className="space-y-6" data-testid={testid}>
      {grupos.map((g) => (
        <section key={g.grupo} data-testid={`instrucoes-grupo-${g.grupo}`} aria-label={g.titulo}>
          {g.grupo !== "entrada" && <h3 className="font-title text-base font-semibold text-ink">{g.titulo}</h3>}
          {g.grupo === "condominio" && <p className="text-xs text-muted" data-testid="instrucoes-condominio-nota">{NOTA_ESTRUTURA_CONDOMINIO_GUIA}</p>}
          {g.grupo === "saida" ? (
            // E662: UMA instrução de saída, o mesmo texto para morador, dono e convidado (sem segundo título).
            <p className="mt-2 whitespace-pre-line text-sm text-ink" data-testid="instrucao-saida-texto">{g.campos[0].valor}</p>
          ) : (
            <dl className="mt-2 space-y-3">
              {g.campos.map((c) => (
                <div key={c.chave}>
                  <dt className="text-sm font-semibold text-ink">{c.rotulo}</dt>
                  <dd className="whitespace-pre-line text-sm text-ink">{c.valor}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      ))}
    </div>
  );
}
