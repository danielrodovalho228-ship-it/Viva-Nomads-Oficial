import { codigoDoErro } from "@/lib/erro-codigo";

/** "Código: 1234567890" embaixo da mensagem de erro (só quando o Next entregou o digest). */
export function CodigoDoErro({ error }: { error: unknown }) {
  const codigo = codigoDoErro(error);
  if (!codigo) return null;
  return (
    <p className="mt-3 text-xs text-muted" data-testid="erro-codigo">
      Código para a equipe: <span className="font-mono">{codigo}</span>
    </p>
  );
}
