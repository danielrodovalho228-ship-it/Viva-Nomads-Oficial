# E792 — "Subir o Supabase local" cai com a porta 54322 presa

## O que o pedido supunha × o que os logs mostram
O pedido supunha uma colisão entre o **Lab crítico** e o **E2E**, que subiriam a mesma stack "no mesmo runner". Os workflows e os logs não sustentam isso:
- **Máquinas separadas:** os jobs rodam em `ubuntu-latest` (imagem ubuntu-26.04), em VMs efêmeras, **uma por job**. Duas runs diferentes nunca dividem máquina.
- **O E2E não sobe Supabase:** o `e2e.yml` testa a URL de preview e não tem passo de Supabase local. Um grupo de concorrência Lab × E2E não mudaria nada.
- **Onde a porta colide:** nas 3 falhas reais desse passo (jobs 129381368513 do lab-critico em 09/11, e 128921513053 e 128902855161 do laboratório em 08–09/11), **dentro de uma mesma VM** o Docker não consegue publicar a 54322 do começo ao fim (`failed to bind host port 0.0.0.0:54322/tcp: address already in use`) nas 3 tentativas, e o diagnóstico do próprio passo (`ss -ltnp`) diz **"nenhuma porta 5432x listada"**. A API (54321) sobe normalmente.
- **Frequência:** 3 jobs entre centenas desde 07/11 (mais de 100 runs do lab-critico só no último dia; 100 runs do laboratório com 12 a 16 fatias cada).

Testei a hipótese de porta **efêmera** (conexão de saída usando a 54322 como origem) e ela **não se confirmou**: com o Docker 29 (bind feito pelo próprio daemon), essa conexão não impede o bind. O dono exato da porta na VM do runner segue desconhecido. O que se sabe com certeza é que **retentar na mesma porta não adianta**.

## Correção (na origem: os workflows)
`scripts/lab/subir-supabase.sh`, usado pelos **4 jobs** que sobem o Supabase local (lab-critico, laboratorio fatias, laboratorio consolidar e linhas-de-base):
1. tenta com a porta do `config.toml` (54322);
2. se a falha for o **bind da porta do banco**, passa o banco para 55322 (depois 56322) e sobe de novo, mudando só `[db] port`;
3. qualquer outra falha segue a defesa que já existia no laboratório: limpa os containers e reinicia o Docker da 2ª tentativa em diante, até 5 tentativas. O **lab-critico ganha essa defesa**, que ainda não tinha (eram 3 tentativas sem reinício, e a falha de 09/11 foi dele).

O script grava `LAB_DB_URL` no `$GITHUB_ENV`, e os `psql` dos workflows passam a usar `psql "$LAB_DB_URL"`. Fora desses `psql`, nada usa a porta do banco: o app, os seeds e os testes falam com a API (54321).

## Provas
- **Teste determinístico** `tests/laboratorio/e792-subir-supabase.test.ts`, com um `supabase` falso que devolve o erro real do log:
  - porta presa → sobe na 55322 e `LAB_DB_URL` acompanha;
  - máquina sadia → 54322, nada muda;
  - outra falha → não troca a porta e termina vermelho;
  - os 4 jobs usam o script e nenhum `psql` fixa a 54322.

  Resultado: na main, 4 falhas; com este PR, 174/0 em `tests/laboratorio`.
- **CLI real** (Supabase 2.120.0, Docker 29.9.1), com a 54322 ocupada nesta máquina:
  - o laço antigo falha em todas as tentativas com o erro idêntico ao do CI;
  - o script sobe na 55322 e o `psql "$LAB_DB_URL"` responde.

## "Duas runs simultâneas no mesmo head"
Duas runs não dividem VM, então não colidem entre si. O caso que derruba o passo, a porta presa dentro de uma VM, é o que o teste e a prova com o CLI real cobrem.
