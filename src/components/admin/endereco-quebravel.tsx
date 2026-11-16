import { Fragment } from "react";
import { pedacosDoEndereco } from "@/lib/admin/endereco-email";

/** E973: o endereço na coluna "Para" quebra só depois do @ e antes de cada ponto (nunca no meio da palavra). */
export function EnderecoQuebravel({ endereco }: { endereco: string }) {
  return (
    <span className="break-words" data-testid="emails-teste-para">
      {pedacosDoEndereco(endereco).map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          {p}
        </Fragment>
      ))}
    </span>
  );
}
