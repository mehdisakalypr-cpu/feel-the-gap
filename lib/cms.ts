import { supabaseAdmin } from "@/lib/supabase";

type CmsMap = Record<string, string>;

/**
 * Fetch CMS content for a collection, returns a slug→value map.
 * Falls back to empty string if slug not in DB.
 */
export async function getCmsContent(
  collection: string,
  lang: "en" | "fr" = "fr"
): Promise<CmsMap> {
  try {
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("cms_content")
      .select("slug, value_en, value_fr")
      .eq("site", "ftg")
      .eq("collection", collection)
      .eq("published", true);

    const map: CmsMap = {};
    for (const row of data ?? []) {
      map[row.slug] = lang === "en" ? row.value_en : row.value_fr;
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * Get a single CMS value with fallback.
 */
export function cmsVal(
  cms: CmsMap,
  slug: string,
  fallback: string
): string {
  return cms[slug] || fallback;
}
