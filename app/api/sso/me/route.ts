import { NextResponse } from "next/server";
import { verifyHubSession } from "@/lib/gapup-sso/verify-session";
import { getProductAccess } from "@/lib/gapup-sso/product-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCT_SLUG = "ftg";

export async function GET() {
  const session = await verifyHubSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "no_hub_session" }, { status: 401 });
  }
  const subs = await getProductAccess(session.userId);
  const hasAccess = subs.some((s) => s.service_slug === PRODUCT_SLUG);
  return NextResponse.json({
    ok: true,
    hub_user_id: session.userId,
    has_access: { [PRODUCT_SLUG]: hasAccess },
    subscriptions: subs,
    session_exp: new Date(session.exp).toISOString(),
  });
}
