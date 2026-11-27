# E804: pagamento descrito de um jeito só nas páginas públicas

Foto da main: `27dbdf1`, que é o commit em produção (deploy pronto na Vercel).

## O que o código diz hoje

| Página | Texto |
|---|---|
| `/para-proprietarios` | "Pagamento mensal direto na sua conta." e "…o valor mensal direto na sua conta." |
| `/como-funciona`, seção do proprietário | "Você decide, gera o contrato e recebe direto na sua conta — a plataforma registra e documenta cada recebimento." |
| `/como-funciona`, seção "Pagamentos" | "Vão direto ao proprietário e ficam registrados na plataforma. Nada passa pela Viva Nomads." |

As três seguem o desenho aprovado: a Viva só conecta e nunca retém valores (aluguel e caução vão direto ao dono).

A frase contraditória "Você paga a estadia direto na plataforma, sem intermediários" **não existe** em `src/`. Também não aparece em nenhum dos últimos 300 commits da main (`git grep`). A `/como-funciona` tem só uma seção "Pagamentos", com o texto acima.

## Guarda ligada

`node --test src/lib/e804-pagamento-direto.test.ts`: **2 pass**.
- Fixa os três textos.
- Varre `src/app/(public)` e falha se alguma página pública disser que o morador paga "na plataforma" ou "sem intermediários".

A checagem de consistência (`check:consistency`, "a plataforma nunca movimenta dinheiro") já protege o vocabulário de dinheiro. Esta guarda cobre a frase específica do item.

## Não reproduz

Sem mudança de texto: a redação já está unificada. Uma leitura de texto da `/como-funciona` (o RELATORIO-010 registra que o extrator pegou seções sem o corpo) pode ter montado a frase a partir de outra fonte. Vale revalidar na próxima prova ao vivo.
