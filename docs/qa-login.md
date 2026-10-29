# Porta de QA (QA-LOGIN-B)

A QA (Muse) entra direto nas **contas de teste** e numa conta de **admin observador**, sem código por e-mail e sem pedir nada ao Daniel. O login das pessoas reais (`/api/auth/codigo`, `/auth`), `is_admin()` e a regra do 2FA do admin (`ADMIN_2FA_OBRIGATORIA`) **não mudam**.

## Como a QA usa

1. Abra no navegador:
   `https://<site>/qa/entrar?email=<conta>&destino=/dashboard`
   - `email`: a conta de teste (ou a do admin observador). O campo já vem preenchido.
   - `destino`: para onde ir depois de entrar (só caminho interno do site; qualquer outra coisa vira `/dashboard`).
2. Cole a **chave da QA** no campo de senha e toque em **Entrar**. Nenhum e-mail é enviado.
3. **Conta de teste:** a página abre o destino já logada.
   **Admin observador:** a sessão sai da porta só com a primeira etapa. Ao abrir o `/admin`, o site pede o **código do app autenticador** da conta, como para qualquer admin. Depois do código, o admin abre.

**A chave nunca vai na URL.** Uma URL com `?chave=` ou `?key=` dá 404 de propósito: a chave já teria ido para o histórico do navegador. Se isso acontecer, troque a chave (passo b abaixo).

Pelo terminal ou por um teste automatizado: `POST /api/qa/entrar` com o corpo JSON `{ "email": "...", "chave": "...", "papel": "tenant" | "owner", "destino": "/..." }`. A resposta grava os cookies da sessão. `papel` só vale para conta nova (sem ele, morador).

## Quem entra

| Situação | Resposta |
|---|---|
| Sem `QA_LOGIN_KEY_HASH` (ou valor que não é um sha256) | 404: a rota e a página não existem |
| Chave errada | 404 |
| Conta de teste (`is_teste`) de morador ou proprietário, sem 2FA | entra |
| Admin observador (`qa_admin`, de teste), antes do lançamento e até 31/12/2026 | entra, e o `/admin` pede o código do app dele |
| Admin observador com `PRE_LANCAMENTO=off` **ou** depois de 31/12/2026 (Brasília) | 404. As contas de teste continuam entrando |
| Cliente real, admin comum, o Daniel, conta de teste com 2FA | 404, sempre |
| Conta que não existe, e-mail dentro de `QA_EMAIL_PADRAO` | cria a conta já como teste (`is_teste`, e-mail confirmado, nunca admin) e entra |
| Conta que não existe, e-mail fora do padrão | 404 |
| Mais de 30 entradas na hora, pelo mesmo IP ou para a mesma conta | 429 |

O próprio Supabase também limita as confirmações de entrada (30 a cada 5 minutos, contadas a partir do servidor do site). Isso só pesa se a QA trocar de conta dezenas de vezes em poucos minutos.

## O que o admin observador pode e não pode

Ele é um admin de verdade (papel `admin` e 2FA próprio) que **só observa** o que é real:

- **Nunca** (o servidor recusa com uma mensagem clara, e a tela esconde onde dá):
  - ligar ou desligar as chaves da plataforma (SMS, parceiro geral);
  - mudar o tipo de conta ou marcar/desmarcar conta de teste;
  - a **Caixa dos Sócios**: a página dá 404, as ações recusam e a RLS da tabela e dos arquivos também fecha;
  - o cartão de backup do Sistema. Backup, restauração e drills são Actions do GitHub; não há botão no site.
- **Dados reais** (conta, imóvel, documento, pedido ou parceiro de quem não é conta de teste): **só leitura**. Aprovar ou recusar documento e matrícula, pausar anúncio, moderar pedido, aprovar ou suspender parceiro, aprovar foto de perfil e decidir verificação de identidade são recusados.
- **Dados de teste**: filas e ações liberadas. É para isso que a conta existe.

## Registro e aviso

Cada entrada fica em `public.qa_entradas` (migrações 0251 e 0252), que só o servidor lê: horário, id da conta, tipo (`teste` ou `admin_qa`), hash do IP e o caminho de destino (sem query). **Nunca** a chave, o e-mail nem o IP. Em Admin → Sistema, a seção **Porta de QA** mostra:
- se a porta está ligada;
- até quando o admin observador entra;
- as entradas dele nos últimos 7 dias.

Uma vez por dia, se o admin observador entrou na véspera, chega ao `AVISO_DANIEL_EMAIL` um aviso **só informativo** (P3), com a hora e o caminho de cada entrada.

## Provisionamento sem o Daniel (roteiro da QA)

Nenhum valor real vai para este documento, para o repositório, para log ou para conversa.

a) **Gerar a chave no seu ambiente** e gravar direto no seu cofre de credenciais, sem imprimir. Por exemplo, gere com `openssl rand -hex 32` e mande a saída direto para o cofre, sem passar pela tela nem por um arquivo.

b) **Calcular o sha256 da chave** (no mesmo ambiente, a partir do cofre) e gravar **só o hash** na Vercel, em Settings → Environment Variables, como `QA_LOGIN_KEY_HASH` (Production e Preview). Grave também `QA_EMAIL_PADRAO`: a expressão regular dos e-mails que podem ser criados como conta de teste, para o e-mail inteiro. Formato de exemplo (não é o valor real): `qa\+[a-z0-9.-]+@seu-dominio\.com`. Depois, faça um novo deploy.

c) **Criar a conta de QA pela porta** com um e-mail dentro do padrão. Ela nasce como conta de teste. Para virar o admin observador, rode a Action **"Admin observador da QA"** (Actions → Run workflow) com o **id** da conta e `promover`. A Action:
- aceita só uuid;
- aceita só conta de teste;
- aceita um observador por vez;
- nunca recebe nem grava e-mail.

O id aparece em Admin → Usuários ou na resposta do banco; `revogar` desfaz.

d) **Cadastrar o 2FA da conta observadora** pelo fluxo normal (Minha conta → Segurança → app autenticador). O segredo do TOTP vai direto para o seu cofre, sem ser exibido em lugar compartilhado. A partir daí, cada entrada no `/admin` pede o código, como para qualquer admin.

e) **Para desligar:**
- **tudo:** apague `QA_LOGIN_KEY_HASH` na Vercel e faça um novo deploy;
- **só o admin observador:** vire `PRE_LANCAMENTO` para `off`, que é o lançamento (a porta lê a variável na hora). Ou espere 31/12/2026: a entrada dele desliga sozinha;
- **trocar a chave:** gere outra (a) e troque o hash (b); a antiga deixa de valer no deploy seguinte.

## Como a sessão é criada

O servidor gera um link de entrada da conta (`auth.admin.generateLink`, tipo `magiclink`) **sem enviá-lo** e o confirma ali mesmo (`verifyOtp` com o `token_hash`), gravando os cookies. Nenhum código sai por e-mail. Nenhum fator de 2FA é criado, removido ou pulado pela porta.
