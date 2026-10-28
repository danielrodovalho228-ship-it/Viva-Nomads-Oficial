# Entrada direta da QA nas contas de teste (QA-LOGIN-B)

A QA entra numa **conta de teste** sem esperar o código por e-mail e sem pedir nada ao Daniel. O login das pessoas reais (`/api/auth/codigo`, `/auth`), o 2FA do admin e `is_admin()` **não mudam**.

## Como a QA usa

1. Abra no navegador:
   `https://<site>/qa/entrar?email=<conta-de-teste>&destino=/dashboard`
   - `email`: a conta de teste (já preenche o campo).
   - `destino`: para onde ir depois de entrar (só caminho interno do site; qualquer outra coisa vira `/dashboard`).
2. Cole a **chave da QA** no campo de senha e toque em **Entrar**.
3. Pronto: a sessão fica gravada no navegador e a página abre o destino. Nenhum e-mail é enviado.

Para trocar de conta, abra o atalho de novo com outro `email`.

**A chave nunca vai na URL.** Uma URL com `?chave=` ou `?key=` dá 404 de propósito (a chave já teria ido para o histórico do navegador). Se isso acontecer, peça uma chave nova ao Daniel.

### Pelo terminal ou por um teste automatizado

`POST /api/qa/entrar` com o corpo JSON `{ "email": "...", "chave": "...", "papel": "tenant" | "owner" }`. A resposta grava os cookies da sessão. `papel` só vale quando a conta ainda não existe; sem ele, a conta nova é de morador.

## Quem pode entrar

| Situação | Resposta |
|---|---|
| `QA_LOGIN_KEY` não definida | 404 (a rota e a página não existem) |
| Chave errada | 404 |
| Conta real (`profiles.is_teste = false`), mesmo com a chave certa | 404 |
| Administrador, ou conta com fator de 2FA | 404, sempre |
| Conta de teste de morador ou proprietário | entra |
| Conta que não existe, e-mail dentro de `QA_EMAIL_PADRAO` | cria a conta já marcada como teste (`is_teste = true`, e-mail confirmado) e entra |
| Conta que não existe, e-mail fora do padrão | 404 |
| Mais de 30 entradas na hora, pelo mesmo IP ou para a mesma conta | 429 |

Além disso, o próprio Supabase limita as confirmações de entrada (30 a cada 5 minutos, contadas a partir do servidor do site). Na prática, isso só pesa se a QA trocar de conta dezenas de vezes em poucos minutos.

## Variáveis (Vercel → Settings → Environment Variables)

- `QA_LOGIN_KEY`: a chave que a QA cola no formulário. Quem cria e cola o valor é o Daniel. Use uma chave longa e aleatória (por exemplo, 32 caracteres ou mais) e não a escreva em documento, ticket ou conversa.
- `QA_EMAIL_PADRAO`: expressão regular dos e-mails que podem ser **criados** como conta de teste. Ela vale para o e-mail inteiro. Exemplo de formato (não é o valor real): `qa\+[a-z0-9.-]+@seu-dominio\.com`. Sem esta variável, nenhuma conta nova é criada; as contas de teste que já existem continuam entrando.

**Para desligar tudo: apague `QA_LOGIN_KEY`** e faça um novo deploy. A rota e a página voltam a dar 404. Para trocar a chave, troque o valor e faça um novo deploy; a antiga deixa de valer na hora.

## Registro

Cada entrada fica em `public.qa_entradas` (migração 0251), que só o servidor lê. O registro guarda o horário, o id da conta, o hash do IP e se a conta foi criada naquela entrada. **Nunca** guarda a chave nem o e-mail. A rota também não escreve a chave nem o e-mail no log.

## Como a sessão é criada

O servidor gera um link de entrada da própria conta (`auth.admin.generateLink`, tipo `magiclink`) **sem enviá-lo** e o confirma ali mesmo (`verifyOtp` com o `token_hash`), gravando os cookies. Nenhum código sai por e-mail.
