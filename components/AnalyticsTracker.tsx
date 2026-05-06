"use client";
import { useEffect } from "react";

/**
 * Cross-domain analytics tracker for SaaS portfolio. Fires events to
 * hub.gapup.io/api/track (CORS allowlisted for *.gapup.io).
 *
 * Privacy-friendly: no cookie, no fingerprinting, server-side daily session_hash.
 * Honors DNT and GPC.
 */

const HUB_TRACK_ENDPOINT = "https://hub.gapup.io/api/track";
const SAAS_SLUG = "feel-the-gap";

export default function AnalyticsTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const dnt = (navigator as Navigator & { doNotTrack?: string; globalPrivacyControl?: boolean })
      .doNotTrack;
    const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
    if (dnt === "1" || gpc === true) return;

    const url = new URL(window.location.href);
    const params = url.searchParams;

    // Determine event name based on path
    const path = url.pathname;
    let event = "saas_pageview";
    if (path === "/demo" || path.startsWith("/demo/")) event = "saas_demo_view";
    else if (path === "/offres") event = "saas_offres_view";
    else if (path === "/dashboard" || path.startsWith("/dashboard/")) event = "saas_dashboard_view";

    fetch(HUB_TRACK_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      mode: "cors",
      credentials: "omit",
      keepalive: true,
      body: JSON.stringify({
        event,
        path,
        utm_source: params.get("utm_source") || undefined,
        utm_medium: params.get("utm_medium") || undefined,
        utm_campaign: params.get("utm_campaign") || undefined,
        meta: { saas_slug: SAAS_SLUG, host: window.location.host },
      }),
    }).catch(() => {
      /* fire-and-forget */
    });
  }, []);

  return null;
}
