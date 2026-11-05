import type { Metadata } from "next";
import Link from "next/link";
import { listProperties } from "@/lib/data/properties";
import { buscaComAnunciosDeTeste } from "@/lib/data/busca-teste";
import { consultaDaBusca, hrefComparar, hrefVoltarBusca, idsDeComparar, montarTabela, MIN_COMPARAR } from "@/lib/busca/comparar";
import { linhaLocalizacao } from "@/lib/localizacao";
import { BrandImage } from "@/components/brand-image";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import type { Property } from "@/lib/types";

export const revalidate = 60;

/** E621: a foto principal do imóvel (a 1ª foto de verdade, a mesma regra do cartão); sem foto, null. */
function fotoPrincipal(p: Property): string | null {
  return p.photos.find((src) => typeof src === "string" && (/^https?:\/\//.test(src) || src.startsWith("/"))) ?? null;
}

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
  const sp = await searchParams;
  const ids = idsDeComparar(sp.comparar);
  // E532: a busca de onde veio (filtros e ordenação) — "Voltar à busca" e "Tirar da comparação" a preservam.
  const volta = consultaDaBusca(sp.volta);
  const voltarBusca = hrefVoltarBusca(volta);
  // E521 (reprova 05/11): a MESMA lista da busca — a conta de teste logada vê ali os anúncios de teste (E571) e, ao
  // marcá-los, eles precisam ser achados aqui também; antes a página lia só a lista pública e caía no estado vazio.
  const incluirTeste = ids.length ? await buscaComAnunciosDeTeste() : false;
  const todos = ids.length ? await listProperties({ incluirTeste }) : [];
  // Mantém a ordem escolhida; id que não existe mais simplesmente some.
  const imoveis = ids.map((id) => todos.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  const tabela = montarTabela(imoveis);

  return (
    <div className="container-page py-6" data-testid="comparar">
      <h1 className="font-title text-2xl font-semibold text-ink">Comparar imóveis</h1>
      {imoveis.length < MIN_COMPARAR ? (
        <div className="mt-4 rounded-xl border border-line bg-white p-4" data-testid="comparar-vazio">
          <p className="text-ink">Escolha de 2 a 3 imóveis na busca para ver os dados lado a lado.</p>
          <Link href={voltarBusca} data-testid="comparar-voltar-busca" className="alvo-toque mt-3 inline-block font-semibold text-forest underline underline-offset-2">
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
                      {/* E621: a coluna abre com a foto principal (4:3, raio de 12 px, como os cartões); sem foto, o espaço reservado. */}
                      <Link href={`/imoveis/${p.id}`} tabIndex={-1} aria-hidden className="mb-2 block" data-testid="comparar-foto">
                        {fotoPrincipal(p) ? (
                          <BrandImage src={fotoPrincipal(p)!} alt={p.title} sizes="(min-width: 768px) 320px, 60vw" className="aspect-[4/3] w-full rounded-xl" />
                        ) : (
                          <PhotoPlaceholder className="aspect-[4/3] w-full rounded-xl" />
                        )}
                      </Link>
                      <Link href={`/imoveis/${p.id}`} className="font-semibold text-forest underline underline-offset-2">
                        {p.title}
                      </Link>
                      <div className="mt-1 text-xs font-normal text-muted">
                        {linhaLocalizacao(p.neighborhood, p.city, p.state)}
                      </div>
                      <Link
                        href={hrefComparar(ids.filter((x) => x !== p.id), volta)}
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
          <Link href={voltarBusca} data-testid="comparar-voltar-busca" className="alvo-toque mt-4 inline-block font-semibold text-forest underline underline-offset-2">
            Voltar à busca
          </Link>
        </>
      )}
    </div>
  );
}
