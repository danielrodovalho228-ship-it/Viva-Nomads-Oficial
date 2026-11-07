# E702 e E661 — resíduos de código (conferidos na `main`, 07/11)

## E702 — a data de disponibilidade é recalculada pelo filtro de duração da busca?
**Não.** Conclusão por leitura do código; nenhum comportamento foi inventado e nenhum texto mudou.
- Cartão da busca, pino do mapa, linhas do painel, comparar e mini-cartão chamam `rotuloPreco({ disponivelEm: property.availableFrom })`: sempre a data do cadastro (`src/components/property-card.tsx:39`, `busca/card-pin-mapa.tsx:35`, etc.).
- O filtro de duração da busca ("1–2 / 3–4 / 5–6 meses", `search-client.tsx`, `filtros-adendo3`) só inclui ou exclui imóveis pelo mínimo e máximo de dias. Não recalcula data.
- A única data calculada é a da página do imóvel (E673, `primeiraEntradaPossivel`, usa a estadia **mínima** do anúncio, não a duração escolhida na busca). Esse cartão já diz de onde vem quando difere do cadastro: `notaDataCalculada` ("Data calculada para a estadia mínima de N dias, olhando os períodos já ocupados.").
- Portanto a mesma casa pode mostrar data diferente entre a lista (cadastro) e a página (calculada). O texto da página já explica; nenhum texto novo é preciso na lista.

## E661 — o guia da estadia do morador renderiza os dois blocos?
**Sim, o código renderiza.** Prova:
- `src/app/(dashboard)/dashboard/estadia/[contratoId]/page.tsx:249-250`: para o morador, `e.instrucoes.liberadas && e.instrucoes.campos` → `<InstrucoesEmBlocos>`; o convidado usa o mesmo componente (`.../convidado/page.tsx:59`).
- `src/components/estadia/instrucoes-em-blocos.tsx` desenha, via `agruparInstrucoes`, os títulos "O imóvel e o que está incluso" e "Estrutura do condomínio", este com a nota "Informado pelo proprietário, pode variar." (`NOTA_ESTRUTURA_CONDOMINIO_GUIA`). Grupo sem texto some.
- Os campos vêm de `lerInstrucoes` (`select("*")` em `imovel_instrucoes_chegada`), então as colunas `condominio_*` (migração 0317) entram sem mudança de código.
- Teste: `src/lib/estadia/e661-instrucoes-em-blocos.test.ts`.

**Por que o morador pode não ver os blocos em produção, apesar do código:** os campos só chegam com `instrucoes.liberadas`, que exige (`instrucoesLiberadas`) D-7 antes da entrada, contrato assinado pelas duas partes e 1º pagamento registrado. Antes disso o morador vê o texto de espera (`instrucoes-bloqueadas`), por desenho. Se o QA viu o guia sem os blocos numa estadia que já cumpria as três condições, preciso do contrato; outra hipótese é a 0317 não estar aplicada em produção (verificação do banco é da Pista B). Observação: a nota "pode variar" aparece só no bloco do condomínio, como o código já fazia; o bloco do imóvel não leva nota.
