# E805 — escada inteira das taxas nas páginas públicas

**Pedido.** Completar a escada 12/10/8/6 + Plano Gestor 4% onde a taxa é apresentada, alinhando `/para-proprietarios`
e `/como-funciona` pela fonte única (E776). A cobrança na renovação aguarda o parecer jurídico: não vira promessa pública.

## Antes
- `/para-proprietarios` (`anunciar-taxa`): "Quanto mais imóveis, menor a taxa de serviço (de 12% a 6%). Plano Gestor: …" — só os extremos.
- `/como-funciona`: nenhuma taxa; o cartão "Renovação" prometia "A taxa do proprietário é cobrada uma vez em cada contrato e em cada renovação".

## Depois
- `escadaTaxasTexto()` em `src/lib/cobranca/regra.ts` monta a escada a partir de `FAIXAS_COMISSAO_PADRAO`
  ("1–2 imóveis: 12% · 3–5 imóveis: 10% · 6–15 imóveis: 8% · 16–19 imóveis: 6%").
- `FRASE_ESCADA_TAXAS` em `src/config/textos-regulados.ts` (fonte única do E776): escada + "Plano Gestor: {GESTOR_TEXTO}".
- As duas páginas usam a mesma frase (`anunciar-taxa` e o novo `cf-taxa-proprietario`, logo abaixo dos passos do proprietário).
- O cartão "Renovação" de `/como-funciona` diz só "A estadia se renova em blocos, com aceite das duas partes."
- Gate do E776: regra `taxa-na-renovacao-em-pagina-publica`, com escopo nas duas páginas.

## Teste
`node --test src/lib/e805-escada-taxas.test.ts` — falha na main (o export não existe), passa na branch.
Asserções alteradas: `e564-textos-gestor`, `planos/e321-porta-gestor`, `t438-vocab-a` (a faixa "de 12% a 6%" virou a escada inteira).

## Fora do escopo (ficam como estão, ver Dúvidas do PR)
Ajuda (`faq.ts`), atendimento (`viva-prompt.ts`), `/termos`, `/privacidade`, `/modelodenegocio` e o Fechamento ainda citam a renovação.
