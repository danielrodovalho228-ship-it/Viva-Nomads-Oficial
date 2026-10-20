// Gera supabase/templates/*.html + LEIA-ME.md a partir de src/lib/notifications/templates-supabase.ts
// Uso: npm run templates:supabase
import { mkdirSync, writeFileSync } from "node:fs";
import { instrucoesSupabase, templatesSupabase } from "../src/lib/notifications/templates-supabase.ts";

const dir = new URL("../supabase/templates/", import.meta.url);
mkdirSync(dir, { recursive: true });
for (const t of templatesSupabase()) writeFileSync(new URL(t.arquivo, dir), t.html + "\n");
writeFileSync(new URL("LEIA-ME.md", dir), instrucoesSupabase());
console.log("Templates gerados em supabase/templates/");
