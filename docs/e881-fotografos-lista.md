# E881 — /parceiros/fotografos abria sem lista e sem estado zero

**Achado:** ao carregar, a página mostrava só o formulário de busca, sem fotógrafo nenhum e sem o "ainda não temos" da busca genérica.
**Causa no código:** `fotografos = cidade ? r.lista : []`, e nada era desenhado sem cidade. Sem cidade, `buscarParceiros({ categoria: "fotografia" })` já devolve todos os publicados.

## Correção
`estadoPaginaFotografos({ buscou, cidade, total })` (`src/lib/fotografos/aviso.ts`):
- sem cidade e com publicados: **lista** "Fotógrafos parceiros publicados (N)", com os mesmos cartões da busca;
- sem nenhum: o estado zero **"Ainda não temos fotógrafo parceiro publicado. Busque pela cidade do seu imóvel acima para pedir aviso quando houver."**;
- com cidade, ou CEP não encontrado: como antes.

## Testes
- `node --test src/lib/fotografos/e881-lista-inicial.test.ts`: main pass 0 / fail 1; branch pass 2 / fail 0.
- Escopados (fotógrafos, parceiros, estilo): 240 / 0. tsc limpo; consistência OK.
- Lab (build da branch): `/parceiros/fotografos` mostra o estado zero (o lab não tem fotógrafo publicado).
  - t231 + t201 + t171 → 13 passed, 2 failed, 6 não rodaram.
  - As falhas são o aviso gravado na seção da cidade (`?cidade=Araguari`, t201) e o painel do admin (t231). Este PR não muda nenhum dos dois.
