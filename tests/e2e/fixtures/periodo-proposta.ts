import { expect, type Locator } from "@playwright/test";

/*
  E520 (reprova 05/11): o passo 1 do "Pedir para morar" exige entrada e saída dentro da disponibilidade e do prazo do
  anúncio (30 a 180 dias). As specs que só atravessam a proposta preenchem aqui um período certo: entrada daqui a
  `aPartirDe` dias (o anúncio do laboratório não tem início de disponibilidade) e `dias` de estadia.
  O campo aceita a data em ISO no computador (texto com máscara) e no celular (campo nativo).
*/
const isoDaqui = (n: number) => {
  const h = new Date();
  return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), h.getUTCDate() + n)).toISOString().slice(0, 10);
};

export async function preencherPeriodoDaProposta(passo: Locator, opts: { aPartirDe?: number; dias?: number } = {}): Promise<{ entrada: string; saida: string }> {
  const aPartirDe = opts.aPartirDe ?? 50;
  const entrada = isoDaqui(aPartirDe);
  const saida = isoDaqui(aPartirDe + (opts.dias ?? 35));
  await passo.getByTestId("solicitacao-inicio").fill(entrada);
  await passo.getByTestId("solicitacao-saida").fill(saida);
  await expect(passo.getByRole("button", { name: "Continuar" })).toBeEnabled();
  return { entrada, saida };
}
