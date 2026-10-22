import type { Metadata } from "next";
import Link from "next/link";
import { listProperties } from "@/lib/data/properties";
import { hrefComparar, idsDeComparar, montarTabela, MIN_COMPARAR } from "@/lib/busca/comparar";

export const revalidate = 60;

// Página de uma seleção pessoal: não entra no Google (a lista de imóveis já está em /buscar).
export const metadata: Metadata = {
  title: "Comparar imóveis",
  robots: { index: false, follow: true },
};

export default async function CompararPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const ids = idsDeComparar((await searchParams).comparar);
  const todos = ids.length ? await listProperties() : [];
  // Mantém a ordem escolhida; id que não existe mais simplesmente some.
  const imoveis = ids.map((id) => todos.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  const tabela = montarTabela(imoveis);

  return (
    <div className="container-page py-6" data-testid="comparar">
      <h1 className="font-title text-2xl font-semibold text-ink">Comparar imóveis</h1>
      {imoveis.length < MIN_COMPARAR ? (
        <div className="mt-4 rounded-xl border border-line bg-white p-5" data-testid="comparar-vazio">
          <p className="text-ink">Escolha de 2 a 3 imóveis na busca para ver os dados lado a lado.</p>
          <Link href="/buscar" className="mt-3 inline-block font-semibold text-forest underline underline-offset-2">
            Voltar à busca
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Rolando para o lado, a coluna dos nomes fica fixa. “—” significa que o anunciante não informou.
          </p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white" data-testid="comparar-rolagem">
            <table className="w-full border-collapse text-sm" data-testid="comparar-tabela">
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 w-24 min-w-24 bg-white p-3 text-left text-xs font-semibold uppercase text-muted">
                    Imóvel
                  </th>
                  {imoveis.map((p) => (
                    <th key={p.id} scope="col" className="min-w-40 p-3 text-left align-top" data-testid="comparar-coluna">
                      <Link href={`/imoveis/${p.id}`} className="font-semibold text-forest underline underline-offset-2">
                        {p.title}
                      </Link>
                      <div className="mt-1 text-xs font-normal text-muted">
                        {p.neighborhood ? `${p.neighborhood}, ` : ""}
                        {p.city}
                      </div>
                      <Link
                        href={hrefComparar(ids.filter((x) => x !== p.id))}
                        className="mt-1 inline-block text-xs font-normal text-muted underline underline-offset-2"
                      >
                        Tirar da comparação
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabela.map((l) => (
                  <tr key={l.chave} className="border-t border-line" data-linha={l.chave}>
                    <th scope="row" className="sticky left-0 z-10 bg-white p-3 text-left font-medium text-ink">
                      {l.rotulo}
                    </th>
                    {l.valores.map((v, i) => (
                      <td key={i} className="p-3 text-ink">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link href="/buscar" className="mt-4 inline-block font-semibold text-forest underline underline-offset-2">
            Voltar à busca
          </Link>
        </>
      )}
    </div>
  );
}
