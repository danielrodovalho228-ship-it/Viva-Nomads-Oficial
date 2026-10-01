# Viva Nomads — app nativo (Capacitor)

Este repositório está configurado para gerar o app **Android e iOS** com
[Capacitor](https://capacitorjs.com), reaproveitando 100% do app web.

## Como funciona (importante)

O Viva Nomads é um app **SSR** (server actions + Supabase), então o app nativo
**não** empacota um site estático. Ele é um **shell nativo que carrega a URL de
produção** (`https://vivanomads.com.br`) numa webview nativa — login, moderação,
pagamentos e tudo o mais continuam funcionando exatamente como na web.

Consequência boa: **atualizações de conteúdo e de funcionalidades entram sozinhas**
(basta o deploy normal na Vercel) — você só republica o app nas lojas quando mudar
algo **nativo** (ícone, splash, plugins, permissões, versão).

Configuração em `capacitor.config.ts` · `appId: br.com.vivanomads.app` · fallback
offline em `www/index.html`.

## O que já está pronto neste repo
- Capacitor instalado (`@capacitor/core`, `android`, `ios`, `cli`).
- `capacitor.config.ts` apontando para produção.
- Projeto **Android** gerado em `android/`.
- Scripts npm (abaixo).

## O que você precisa na sua máquina
- **Android:** [Android Studio](https://developer.android.com/studio) (inclui o SDK). Funciona em Windows, Mac ou Linux.
- **iOS:** um **Mac** com **Xcode** e **CocoaPods** (`sudo gem install cocoapods`). iOS só compila no macOS.

## Rodar o app Android
```bash
npm install
npm run cap:sync        # copia config/assets e sincroniza plugins
npm run cap:android     # abre o projeto no Android Studio
```
No Android Studio: selecione um emulador ou celular e clique em **Run (▶)**.

### Gerar o APK/AAB para a Play Store
No Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle (.aab)**,
crie/escolha sua *keystore* de assinatura e gere o `.aab`. Esse arquivo é o que
sobe no **Google Play Console**.

## Rodar o app iOS (num Mac)
```bash
npm run cap:add:ios     # gera o projeto ios/ (só na primeira vez, num Mac)
npm run cap:sync
npm run cap:ios         # abre no Xcode
```
No Xcode: configure *Signing & Capabilities* com sua conta Apple Developer, rode
num simulador/aparelho e publique via **Archive → Distribute App** no App Store Connect.

## Ícone e splash (marca verde)
Gere todos os tamanhos a partir de uma arte única:
```bash
npm i -D @capacitor/assets
# coloque uma arte 1024x1024 em resources/icon.png e um splash em resources/splash.png
npx capacitor-assets generate
```
Use a identidade verde (logo VivaNomads). Há ícones base em `public/icon-512.png`,
mas o ideal é uma arte 1024px dedicada.

## Riscos e mitigação (leia antes de publicar na App Store)
A Apple pode rejeitar apps que são "só um site numa webview"
(*Guideline 4.2 — Minimum Functionality*). Para reduzir o risco, vale adicionar
algo **nativo** de verdade antes de submeter:
- **Notificações push** (`@capacitor/push-notifications`) — avisar o dono de uma
  nova candidatura, o inquilino de uma resposta. Alto valor e resolve o 4.2.
- **Deep links / compartilhamento nativo**, **câmera** para fotos do anúncio.

A Play Store (Google) é bem mais tolerante com esse formato.

## Atualizando o app
- Mudou **código/conteúdo** do site → só faça o deploy (Vercel). O app pega sozinho.
- Mudou **ícone, splash, plugin, permissão ou versão** → `npm run cap:sync`, suba
  a versão em `android/app/build.gradle` (e no Xcode) e **republique nas lojas**.
