# Publicar o app Android na Play Store (teste fechado)

Guia prático, no **Windows/PowerShell**, para gerar o pacote assinado (`.aab`) do
Viva Nomads e subir no **teste fechado**. O app é a casca Capacitor que carrega
`https://vivanomads.com.br` — então melhorias no site aparecem no app sem nova
versão na loja. Só se re-publica para mudanças nativas (ícone, splash, permissões,
plugins, versão).

> Pré-requisitos no seu PC: **Android Studio** instalado, **JDK** (vem com o
> Android Studio), este repositório clonado, e `npm install` já rodado.

---

## 1. Sincronizar o projeto nativo

No PowerShell, na raiz do repositório:

```powershell
npm install
npx cap sync android
```

Isso copia a config e os plugins (push, app, browser) para `android/`.
O **ícone e o splash** já foram gerados (verde da marca) e versionados.

---

## 2. Firebase (push) — colocar o `google-services.json`

1. Você cria o projeto no Firebase e registra o app Android com o pacote
   **`br.com.vivanomads.app`** (passo que já está no seu checklist).
2. Baixe o `google-services.json` e **coloque em**:

   ```
   android/app/google-services.json
   ```

3. O `android/app/build.gradle` já aplica o plugin do Google **só quando** esse
   arquivo existe — não precisa editar nada. Sem o arquivo, o app compila e roda
   normalmente; o push só não dispara.
4. No servidor (Vercel), configure a variável **`FCM_SERVICE_ACCOUNT_JSON`** com o
   JSON da conta de serviço do Firebase (Service accounts → Generate new private
   key). Sem ela, o envio de push é um no-op (não quebra nada).

> ⚠️ **PROTEÇÃO IMPORTANTE — não trave o app sem o Firebase.** No Android, chamar
> `PushNotifications.register()` **sem** o `google-services.json` no build derruba o
> app (erro nativo de FirebaseApp, que o try/catch do JS não pega). Por isso o app
> só tenta registrar push quando a flag **`NEXT_PUBLIC_PUSH_ATIVO="on"`** está
> ligada (na Vercel). **Mantenha-a DESLIGADA** até que o app **publicado/instalado**
> já contenha o `google-services.json`. Ordem segura:
> 1. Gere o 1º app de teste **sem** Firebase e **com a flag OFF** → o push nem é
>    tentado, o app não quebra.
> 2. Faça o Firebase, coloque o `google-services.json` em `android/app/`, gere um
>    novo `.aab` e publique/instale.
> 3. **Só então** ligue `NEXT_PUBLIC_PUSH_ATIVO="on"` na Vercel → o push passa a
>    funcionar em todos os apps atualizados.

---

## 3. Criar a chave de assinatura (uma vez só)

A Play exige o app assinado. Crie um **keystore** e guarde em local seguro
(perder = não conseguir mais atualizar o app pela mesma listagem).

```powershell
keytool -genkey -v -keystore vivanomads-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias vivanomads
```

Anote a senha do keystore e a senha da key. **Faça backup do arquivo `.jks` e das
senhas** (gerenciador de senhas + cópia offline). Esta é a sua **chave de upload**.

> **Play App Signing (recomendado e padrão):** no 1º envio, a Play passa a
> gerenciar a *chave de assinatura do app* e você continua assinando os uploads
> com a sua *chave de upload*. Mantenha o backup da chave de upload; se perdê-la,
> dá para pedir reset à Play, mas é burocrático. Deixe o Play App Signing LIGADO.

---

## 4. Gerar o `.aab` assinado

> 🚫 **REGRA — nunca gere um `.aab`/APK sem o `google-services.json`** em
> `android/app/`. A flag `NEXT_PUBLIC_PUSH_ATIVO` fica na Vercel e é **global**:
> ela vale para todos ao mesmo tempo e **não protege apps já instalados**. Se você
> distribuir um app sem Firebase e depois ligar a flag, os aparelhos com o app
> antigo fecham sozinhos. Portanto: **faça o Firebase ANTES do primeiro app**,
> inclua sempre o `google-services.json` no build, e só então ligue a flag.

### Opção A — Android Studio (mais simples)
1. `npx cap open android` (abre o projeto no Android Studio).
2. **Build → Generate Signed Bundle / APK → Android App Bundle**.
3. Selecione o keystore `vivanomads-upload.jks`, alias `vivanomads`, as senhas.
4. Build variant **release** → gera o `.aab` em
   `android/app/release/app-release.aab`.

### Opção B — linha de comando
Crie `android/keystore.properties` (NÃO comitar — já coberto pelo `.gitignore` do
Android; confirme):

```properties
storeFile=../vivanomads-upload.jks
storePassword=SUA_SENHA
keyAlias=vivanomads
keyPassword=SUA_SENHA
```

E no `android/app/build.gradle`, dentro de `android { }`, um `signingConfigs` que
lê esse arquivo e aplica no `buildTypes.release`. Depois:

```powershell
cd android
.\gradlew.bat bundleRelease
```

O `.aab` sai em `android/app/build/outputs/bundle/release/`.

> Antes de cada envio, **suba o `versionCode`** em `android/app/build.gradle`
> (1 → 2 → 3…). O `versionName` ("1.0.0") é o rótulo visível.

---

## 5. Play Console — criar e subir

1. **Conta** em play.google.com/console (US$ 25, uma vez). Decida:
   - **Pessoal:** aprova mais rápido, mas exige **teste fechado com 12 testadores
     por 14 dias** antes de liberar para todos.
   - **Organização (Vittelle LLC):** dispensa esse teste, mas precisa do número
     **D-U-N-S** (leva alguns dias).
2. **Criar app** → nome "Viva Nomads", app, gratuito.
3. **Teste fechado → criar faixa → subir o `.aab`** → adicionar a lista de
   e-mails dos testadores (ou um Grupo do Google). Compartilhe o link de opt-in.

---

## 6. O que a Play Console EXIGE (tenha pronto)

- **Política de privacidade (URL):** `https://vivanomads.com.br/privacidade`
- **Exclusão de conta:**
  - **No app:** **Conta → Excluir conta** (usa `delete_user_account()`, apaga o
    perfil e cascateia os dados).
  - **Na web (link público exigido pela Play):** **`https://vivanomads.com.br/excluir-conta`**
    — página pública (sem login) que explica o caminho pelo app e tem um formulário
    que envia, por e-mail, um link de confirmação; ao confirmar, a conta é apagada.
    Linkada no rodapé e na `/privacidade`. **Use esta URL** no campo de exclusão de
    conta da Play Console.
- **Formulário "Segurança dos dados" (Data safety)** — preencher com o que o app
  coleta:

  | Dado | Coletado | Finalidade | Observação |
  |---|---|---|---|
  | Nome | Sim | Conta, funcionalidade | — |
  | E-mail | Sim | Conta, login, avisos | — |
  | Telefone | Opcional | Avisos (WhatsApp opt-in) | só se o usuário informar |
  | Fotos/conteúdo do usuário | Sim | Anúncios, vistorias | EXIF/GPS removido no upload |
  | Documentos (matrícula) | Sim | Conferência (anti-fraude) | bucket privado, URL assinada curta |
  | Identificadores (token de push) | Sim | Notificações | removido no logout |

  Declarar: **dados criptografados em trânsito**; **o usuário pode pedir exclusão**
  (link acima). Pagamento/aluguel **não** passam pelo app (plataforma só conecta).
- **Classificação de conteúdo (questionário):** app sem conteúdo sensível →
  tende a **Livre / Everyone**. Responda o questionário com sinceridade.
- **Público-alvo:** adultos (18+), não direcionado a crianças.
- **Nível de API alvo:** a Play exige que apps novos mirem uma API recente. O
  projeto está em **`targetSdk 36`** (Android 16), que **atende o alvo atual**
  (o piso vigente é API 35 / Android 15). ⚠️ Confirme o número exato na tela da
  Play Console no dia do envio — ela avisa se mudou.

---

## 7. Ficha da loja (texto em português)

**Nome:** Viva Nomads

**Descrição curta** (máx. 80 caracteres):
> Aluguel mobiliado por temporada, de 30 a 180 dias, com contrato e segurança.

**Descrição completa** (sugestão):
> O Viva Nomads conecta quem precisa morar por temporada — de 30 a 180 dias — a
> imóveis mobiliados e prontos para morar, começando por Uberlândia.
>
> Para quem procura: busque por bairro, duração e preço, veja fotos e o selo
> "Documentação conferida", converse com o proprietário com segurança e candidate-se.
>
> Para quem tem imóvel: anuncie, receba candidaturas, feche o contrato em blocos e
> acompanhe tudo pelo app.
>
> Segurança em primeiro lugar: a identidade do interessado só aparece após o
> aceite, o contato fica protegido no chat, e a plataforma **conecta e documenta —
> não é parte do contrato** e **nunca movimenta o aluguel nem a caução**.
>
> Locação por temporada, art. 48 da Lei 8.245/91.

**Categoria — recomendação:** **"Casa e decoração" (House & Home).**
O Viva Nomads é **moradia** por temporada (meses), não turismo de poucos dias.
"Viagem e local" (Travel & Local) sugere hospedagem curta/turística e pode atrair
o público errado e comparação com Airbnb. Fique em **Casa e decoração**; use
"Viagem e local" só se a Play recomendar outra coisa na revisão.

---

## 8. Imagens exigidas pela ficha

- **Ícone do app:** 512×512 PNG (a Play usa o upload próprio; a arte da marca já
  está em `assets/icon-only.png`, base 1024 — exporte 512 a partir dela).
- **Feature graphic:** 1024×500 PNG/JPG (banner no topo da ficha).
- **Capturas de tela do telefone:** 2 a 8, proporção retrato (ex.: 1080×1920),
  mín. 320px no lado menor. Sugestão: Início, Busca, Imóvel, Candidatar-se,
  Mensagens, Painel.
- (Opcional) capturas de tablet 7" e 10".

> As capturas saem do próprio app rodando no emulador/aparelho (ou do site em
> largura de celular). Mantêm o padrão visual "3 S" (verde da marca, uma ação
> principal por tela).

---

## 9. Checklist de teste manual no emulador (antes de subir)

Rode no emulador do Android Studio e confirme:

- [ ] App abre e carrega `vivanomads.com.br` (login, busca, imóvel funcionam).
- [ ] **Botão Voltar** do Android volta uma página; na tela inicial, fecha o app.
- [ ] **Links externos** abrem no **navegador do sistema**, não dentro do app:
      teste `wa.me` (WhatsApp), Google Maps e ZapSign, e qualquer link
      `target="_blank"`. Se algum abrir dentro do app, me avise (ajusto o
      `native-bridge`).
- [ ] **Mapa, vídeo e imagens** continuam carregando **dentro** do app (não devem
      ser interceptados).
- [ ] **Push:** com `NEXT_PUBLIC_PUSH_ATIVO="on"` **e** o `google-services.json` no
      build, após o login aparece a frase pedindo permissão e o token é registrado.
      Com a flag OFF (ou sem o arquivo), o push **não é tentado** e o app **não
      quebra**. (O disparo real precisa também do `FCM_SERVICE_ACCOUNT_JSON` na Vercel.)
- [ ] **Logout** remove o token do aparelho (celular compartilhado).
