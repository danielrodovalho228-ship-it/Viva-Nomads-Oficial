# E391 — teste de carga (itens 2 e 3)

Data: 01/11/2026 · Pista B

## Resumo

1. **O teste de 200 usuários por 10 minutos não foi rodado, de propósito.** O Preview usa o mesmo Supabase da produção. Carga no Preview seria carga na produção.
2. **O `getUser` do proxy não é gargalo hoje.** No Auth de produção, nas últimas 24 h: mediana de 3,8 ms, p95 de 123 ms, nenhum 429 e nenhum 5xx. O pico de ~10 chamadas por segundo rodou com p95 de 5,5 ms.
3. **Item 3 (validação local do token): não proposto agora.** A condição do pedido ("só se houver gargalo") não se cumpriu. Abaixo fica o que mudaria isso e como seria.

## 1. Por que a carga não rodou

- Na Vercel, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são uma variável só, com alvo **Preview + Produção**. Todo Preview conversa com o projeto `esezeutgtycekfosxplk`, o banco real.
- O Preview tem `AUTOMACOES_ATIVO=1`. Tráfego sintético em tela logada pode disparar automações e e-mails reais.
- 200 usuários logados exigiriam 200 contas de teste no Auth de produção.
- Este ambiente não alcança `*.vercel.app`: o proxy de saída responde 403.

Para rodar de verdade é preciso um Supabase separado para o Preview (um branch do Supabase ou um projeto de carga), com as três variáveis apontando para ele só no alvo Preview. Isso é mudança de configuração do Supabase e da Vercel, então **depende do OK do Daniel**. O roteiro já está pronto em `scripts/carga/e391-carga.mjs` e se recusa a rodar sem a confirmação explícita de que o Supabase é separado.

## 2. O que os dados de produção mostram (só leitura)

Fonte: logs do Auth do Supabase (`auth_logs`), últimas 24 h até 01/11 19h UTC. A duração é o tempo de serviço dentro do Auth. O Supabase fica em us-east-1 e as funções da Vercel em `iad1`, a mesma região, então a ida e volta soma ~1–2 ms.

| Rota do Auth | Chamadas | p50 | p95 | p99 | Máx. | 429 | 5xx |
|---|---|---|---|---|---|---|---|
| `GET /user` (o `getUser`) | 19.923 | 3,8 ms | 122,6 ms | 633,4 ms | 4.589 ms | 0 | 0 |
| `/token` (login e renovação) | 35 | 162 ms | 497 ms | 784 ms | 920 ms | 0 | 0 |

**Volume contra latência.** O minuto mais cheio (12:58, 587 chamadas, ~10/s) teve p95 de 5,5 ms. Os minutos com a cauda mais lenta (de 2,3 a 4,6 s) tiveram de 41 a 257 chamadas. A lentidão não acompanha o volume: são picos isolados do Auth, não saturação.

**Chamadas por navegação.** São 172 arquivos que chamam `auth.getUser()`. Uma navegação logada paga 1 no proxy, mais uma por componente de servidor ou ação que cria o cliente. O proxy já corta o gasto à toa:
- prefetch de rota protegida responde 204 sem `getUser`;
- sem cookie de sessão não há ida ao Auth (`precisaVerificarUsuario`).

## 3. Projeção para 200 usuários

Hipótese: 200 pessoas logadas, uma navegação a cada ~15 s e ~3 chamadas a `/user` por navegação. Isso dá **~40 chamadas por segundo**, cerca de 4 vezes o pico já observado. Com p50 de 3,8 ms, o Auth ocupa em média ~0,15 de uma conexão para isso. Não há sinal de fila.

O que esta projeção **não** cobre, e só a carga real cobriria:
- o tamanho de computação do Auth e do banco sob tráfego sustentado (o `/user` também lê `auth.users`);
- o limite de renovação de token por IP do Supabase. Um gerador de carga saindo de um IP só bateria nesse limite, e seria um artefato do teste, não um problema de usuário real. O roteiro reparte as sessões e não força renovação.

## 4. Item 3: quando propor a validação local do token

**Gatilhos** (qualquer um deles):
- p95 do `/user` acima de 300 ms em minutos de pico;
- 429 ou 5xx no `/user`;
- o tempo do proxy dominando o TTFB das telas logadas.

**Como seria:** o proxy troca `getUser()` por `getClaims()`. Com chave de assinatura assimétrica (JWT Signing Keys), o token é verificado localmente contra a JWKS em cache, sem ida ao Auth. As ações e páginas que gravam dados seguem com `getUser()`.

**Custo da troca:**
- uma sessão revogada (Sair de todos os aparelhos, conta banida) segue valendo no proxy até o token expirar (1 h por padrão);
- exige migrar o projeto para chaves assimétricas, o que é configuração do Supabase e depende do OK do Daniel.

Por isso não vale fazer sem o gatilho.

## 5. Para rodar a carga quando houver Supabase separado

```bash
BASE_URL=https://<preview>.vercel.app \
CONFIRMO_SUPABASE_SEPARADO=1 \
USUARIOS=200 MINUTOS=10 \
COOKIES_ARQUIVO=./sessoes.txt \
node scripts/carga/e391-carga.mjs
```

- `COOKIES_ARQUIVO`: uma linha por usuário, com o cabeçalho `Cookie` de uma sessão de teste do Supabase separado. Sem esse arquivo, o roteiro roda só as telas públicas.
- O roteiro imprime p50, p95, p99, a contagem por status e a contagem de redirecionamentos para `/auth`, que indicam sessão perdida.
- Depois de rodar, cruzar com os logs do Auth do projeto de carga, com a mesma consulta da seção 2.
