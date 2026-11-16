import Link from "next/link";
import { pedacosComLigacoes, pedacosComRemissoes } from "@/lib/ajuda/remissoes";

/**
 * E906: o texto de uma resposta da Ajuda ou de um guia, com as remissões a destinos vivos como links.
 * E941: `nomeados` (respostas da Ajuda) também liga os destinos que a resposta NOMEIA ("a página Conferir documento").
 */
export function TextoComRemissoes({ texto, nomeados = false }: { texto: string; nomeados?: boolean }) {
  return (
    <>
      {(nomeados ? pedacosComLigacoes(texto) : pedacosComRemissoes(texto)).map((p, i) =>
        p.href ? (
          <Link key={i} href={p.href} className="font-semibold text-forest underline underline-offset-2" data-testid="remissao-link">
            {p.texto}
          </Link>
        ) : (
          <span key={i}>{p.texto}</span>
        ),
      )}
    </>
  );
}
