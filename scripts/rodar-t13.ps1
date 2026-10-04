# ════════════════════════════════════════════════════════════════════════════
# Roda o teste de segurança t13-seguranca-rls contra o Supabase de PRODUÇÃO.
# Use DEPOIS de aplicar a 0052 E a 0053 (C3/C4 só passam depois da 0053).
#
# Como rodar (PowerShell, na pasta do repositório):
#   powershell -ExecutionPolicy Bypass -File scripts\rodar-t13.ps1
#
# O script pede a URL e a chave anon do Supabase (Supabase > Project Settings >
# API) e as contas de TESTE. As senhas são digitadas na hora e não ficam salvas.
# O único dado gravado pelo teste é o preferred_mode da conta, regravado com o
# MESMO valor.
# ════════════════════════════════════════════════════════════════════════════
$ErrorActionPreference = "Stop"

function Ler-Senha([string]$rotulo) {
  $seguro = Read-Host -Prompt $rotulo -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

Write-Host "1/4 Instalando dependências (npm ci)..."
npm ci

Write-Host "2/4 Instalando o Chromium do Playwright..."
npx playwright install chromium

Write-Host "3/4 Dados do Supabase e das contas de teste"
$env:NEXT_PUBLIC_SUPABASE_URL = Read-Host -Prompt "URL do Supabase (https://xxxx.supabase.co)"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = Read-Host -Prompt "Chave anon (pública) do Supabase"
$env:TESTES_BASE_URL = "https://vivanomads.com.br"

$env:TESTES_INQUILINO_EMAIL = Read-Host -Prompt "E-mail da conta de teste INQUILINO (ex.: inquilino2)"
$env:TESTES_INQUILINO_SENHA = Ler-Senha "Senha do inquilino"

$prop = Read-Host -Prompt "E-mail da conta de teste PROPRIETÁRIO (proprietario2 ou proprietario3cnpj; Enter para pular)"
if ($prop) {
  $env:TESTES_PROPRIETARIO_EMAIL = $prop
  $env:TESTES_PROPRIETARIO_SENHA = Ler-Senha "Senha do proprietário"
}

Write-Host "4/4 Rodando o t13..."
npx playwright test tests/e2e/specs/t13-seguranca-rls.spec.ts --reporter=list

# Limpa as variáveis desta sessão do PowerShell.
Remove-Item Env:TESTES_INQUILINO_SENHA, Env:TESTES_PROPRIETARIO_SENHA -ErrorAction SilentlyContinue
