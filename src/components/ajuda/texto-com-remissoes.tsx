import Link from "next/link";
import { pedacosComRemissoes } from "@/lib/ajuda/remissoes";

/** E906: o texto de uma resposta da Ajuda ou de um guia, com as remissões a destinos vivos como links. */
export function TextoComRemissoes({ texto }: { texto: string }) {
  return (
    <>
      {pedacosComRemissoes(texto).map((p, i) =>
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
