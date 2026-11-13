# E796: as 5 regressões novas da rodada fatiada de 12/11

Origem: o inventário do E744 (`docs/e744-completude-12-11.md`, #3747). Na rodada de 03:13 os cinco specs estavam verdes; na de 12:14 (`0cc71c1f6`), vermelhos.

**Regra do item:** reproduzir antes de corrigir. As 5 reproduziram na main atual (`b345c94e`), no lab local: Supabase local, massa da varredura e build de produção.

## 1. t406, t407, t408 e t551: página do imóvel, "clique no botão primário sem resposta visível em 3 s"

**Reprodução na main** (os quatro, a 1280 e a 390 px, visitante na página do imóvel da massa):

```
VARREDURA|clique|1280|visitante|/imoveis/:id|botão "Anúncio de teste da equipe Viva — não é um imóvel disponível" desabilitado sem explicar o motivo
VARREDURA|clique|390|visitante|/imoveis/:id|botão "Anúncio de teste da equipe Viva — não é um imóvel disponível" desabilitado sem explicar o motivo
```

Nos 4 specs, só as telas "visitante — Página do imóvel" caíram por isso. O t407, o t408 e o t551 também tiveram falhas nas telas do **admin**, com a mensagem "caiu fora da tela (login ou redirecionamento)". Essas são do lab local: a sessão gravada da persona admin desta máquina está vencida, e as mesmas telas não estão entre as regressões do CI.

**Causa: o E786 (#3743).** A massa da varredura cria o imóvel com dono `is_teste`. Desde o E786, o anúncio de dono-conta-de-teste é **anúncio de teste**, ainda que o título não tenha a marca. Isso é o decidido. Para o visitante, o "Pedir para morar" fica **desativado** (E93), com o texto da faixa como rótulo, também o decidido. Só que o botão desativado não dizia **por quê**: não tinha `aria-describedby` nem `title`, e não havia aviso no mesmo bloco. É a "trava silenciosa" que o critério (f) da varredura reprova. Antes do #3743, o imóvel da massa não era anúncio de teste e o clique respondia.

Os outros suspeitos (#3737, #3738/E795 e #3735) não entram: a mensagem do achado é a trava do anúncio de teste.

**Correção:**
- **Faixa:** ganhou `id="faixa-anuncio-teste"`.
- **Cartão lateral (computador):** o botão desativado do visitante ganhou `aria-describedby` apontando para a faixa.
- **Rodapé fixo (celular):** a barra recebe a nova prop `bloqueioMotivoId` e põe o mesmo `aria-describedby` no botão desativado.
- **O que não mudou:** o desenho, os textos e a regra do E93/E786.

**Teste ligado:** `tests/e2e/specs/t1610-e796-trava-explicada.spec.ts`. Dono `is_teste` e visitante, a 1280 e 390 px. O primário desativado precisa ter `aria-describedby` para a faixa com o texto especificado, e o `cliqueResponde` da varredura não pode achar nada.

## 2. t373: a data de nascimento não grava (esperado `1991-03-14`, recebido `null`)

**Reprodução na main:** o t373 nº 2 falha. No lab local, ele falha um passo antes do que no CI: o "31/02/1991" digitado some antes do Salvar, então o aviso "Data de nascimento inválida." nunca aparece. No CI, o mesmo efeito pegou o "14/03/1991" e gravou `null`.

**Causa: uma corrida em Conta › Dados** (`src/components/account/conta-secoes.tsx`).
1. O campo de nascimento ficava **editável antes de a data gravada chegar**.
2. Quando o `getNascimento()` resolvia, o `setNascimento(n)` **sobrescrevia** o que a pessoa já tinha digitado. Para uma conta sem data gravada, o campo voltava a `""`.
3. Ao Salvar, uma data vazia é válida e não grava nada, e a gravada continuava `null`.

As Server Actions da tela (dados, nascimento e documento) vão **em fila**. Por isso, quanto mais lenta a resposta, maior a janela da corrida. O telefone já tinha essa proteção desde o E372; a data de nascimento não. Não isolei qual mudança de 12/11 alargou a janela no CI. A corrida em si existe no código e o t1609 a reproduz de forma determinística.

**Teste ligado:** `tests/e2e/specs/t1609-e796-nascimento-corrida.spec.ts`. As Server Actions da tela são atrasadas em 2,5 s.

Na main:
```
Error: a leitura atrasada não apaga o que foi digitado
Expected: "14/03/1991"
Received: ""
```

**Correção** (a mesma regra do telefone no E372):
- o campo fica desativado, com "Carregando…", até a data gravada chegar;
- o "Salvar" também espera;
- se a leitura falhar, vale a regra que já existia: o campo fica travado com o aviso, e salvar não mexe na data.

## Asserções alteradas (decisão: E796)

- `src/components/account/e372-dados-telefone-cpf.test.ts`: o `disabled` do "Salvar" agora também espera a data de nascimento.
- `src/components/property/e786-selo-teste-sem-transbordo.test.ts`: a faixa `<p>` ganhou o `id` entre `role` e `data-testid`. A contagem dos usos de `FAIXA_TESTE` passou a usar `\b` no começo, para não contar o `ID_FAIXA_TESTE` (o id, não um rótulo).
- `src/lib/data/vazio-nascimento.test.ts`: a leitura da data também marca "carregou", o campo fica `disabled={nascFalhou || !nascCarregado}` e o salvar espera a leitura.
