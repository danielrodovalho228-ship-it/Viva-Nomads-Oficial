# DESTINO-PESSOAL-B — "Outro local" pessoal na busca

Pista B · migração 0240.

## (a) Âncoras oficiais
Não mudam. São os chips de `destinos`, o cadastro de /admin/destinos e o cache de tempos do Prompt 37.

## (b) "Outro local" pessoal
- **Busca no servidor.** A pessoa digita o nome do lugar ou o endereço e toca em "Buscar". A ação `buscarOutroLocal` procura no Nominatim (OSM) e, sem resultado, no Mapbox (só com token). O campo aparece sempre, porque não depende mais do token do navegador.
- **Limite:** 30 buscas por hora, por pessoa (ou por IP, sem login).
- **Logada:** o local fica em `destinos_pessoais`, com rótulo sem número de casa e ponto com 3 casas.
  - RLS: só a própria pessoa lê, grava e apaga. **Não há política para o admin.**
  - Volta como "Seus locais", até 10 locais (o mais antigo sai).
- **Sem login:** nada é guardado; o local vai só na URL (`dlat`/`dlng`/`drot`, como no Prompt 37).
- **Tempo:** o mesmo `/api/tempos`. Com provedor de rotas, minutos do motor do Prompt 37. Sem provedor, "≈ 1,4 km em linha reta até …", **nunca minutos inventados**.
- **Não achou:** aparece "Não achamos este endereço." e o botão "Não achei meu local".
  - O botão abre um formulário com nome do lugar e cidade.
  - O pedido vai para `destinos_nao_achados` (limite de 5 por dia), que só o servidor grava e lê.

## (c) Admin (/admin/destinos)
- **"Lugares que muita gente usa (90 dias)":** só o que a função `destinos_pessoais_agregado()` devolve.
  - É o centro de cada região de ~300 m (0,0027° × 0,0029°) com **5 pessoas distintas ou mais** nos últimos 90 dias.
  - Não traz endereço, rótulo nem quem.
  - Só `service_role` executa; a tela nunca lê a tabela.
- **"Promover a âncora":** abre o cadastro de destinos de sempre com o centro da região preenchido. O admin dá o nome, confere no mapa, salva e ativa.
- **"Locais pedidos: Não achei meu local":** a fila na mesma tela, com "Cadastrar" e "Resolvido".

## Testes
- `src/lib/destinos/pessoal.test.ts` cobre:
  - a grade (igual à do banco);
  - o agregado esconde menos de 5 pessoas distintas e usos com mais de 90 dias;
  - sem endereço nem quem;
  - ponto com 3 casas;
  - rótulo sem número;
  - pedido "Não achei";
  - endereço inválido leva ao pedido;
  - linha reta sem token;
  - RLS e privacidade.
- **Migração (Postgres local):**
  - aplicar duas vezes funciona;
  - o agregado mostra só a região com 5 pessoas (as com 4 e com uso antigo ficam fora);
  - 5 casas decimais são recusadas;
  - a dona vê os locais dela, outra conta não vê nenhum;
  - ninguém grava em nome de outro;
  - o cliente não roda o agregado nem lê os pedidos;
  - o rollback roda duas vezes e reaplicar volta.
- **E2E `t390-destino-pessoal`** (laboratório com OSM simulado):
  - sem login, o local vai só na URL;
  - "Não achamos" leva ao pedido;
  - logada, aparece em "Seus locais";
  - admin vê a região com 5, não a com 4, e nenhum rótulo;
  - "Promover a âncora" preenche o ponto;
  - o pedido é resolvido.
