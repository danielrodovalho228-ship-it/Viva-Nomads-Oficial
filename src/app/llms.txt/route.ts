import { llmsTxt } from "@/lib/seo/llms";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
  return new Response(llmsTxt(SITE_URL), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
