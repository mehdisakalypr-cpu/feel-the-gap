"use client";

import { useState } from "react";
import Link from "next/link";

export default function CompanyRemovePage() {
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [reason, setReason] = useState("");
  const [proof, setProof] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/companies/remove-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          companyName,
          profileUrl,
          reason,
          proof,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data?.error || "Erreur. Réessaie.");
        return;
      }
      setDone(true);
    } catch {
      setErr("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link
          href="/companies"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Companies directory
        </Link>

        <h1 className="text-3xl font-bold mt-4 mb-2">
          Demande de retrait de fiche entreprise
        </h1>
        <p className="text-muted-foreground mb-8">
          Conformément au RGPD et aux droits applicables sur les données publiques d'entreprises,
          vous pouvez demander la suppression d'une fiche company. Nous traiterons votre demande
          sous 30 jours.
        </p>

        {done ? (
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-6">
            <h2 className="text-xl font-semibold mb-2">Demande reçue ✓</h2>
            <p className="text-muted-foreground">
              Nous traiterons ta demande sous 30 jours et te confirmerons par email à{" "}
              <strong>{email}</strong>. Si nous avons besoin d'éléments supplémentaires,
              nous te recontactons.
            </p>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="grid gap-4 rounded-lg border border-border p-6"
          >
            <Field label="Votre email *">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border border-border rounded-md px-3 py-2 outline-none focus:border-purple-500"
              />
            </Field>

            <Field label="Nom de l'entreprise concernée *">
              <input
                type="text"
                required
                placeholder="Acme Trading Ltd"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-transparent border border-border rounded-md px-3 py-2 outline-none focus:border-purple-500"
              />
            </Field>

            <Field label="URL de la fiche à retirer">
              <input
                type="url"
                placeholder="https://www.gapup.io/companies/gb/acme-trading-ltd-..."
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
                className="w-full bg-transparent border border-border rounded-md px-3 py-2 outline-none focus:border-purple-500"
              />
            </Field>

            <Field label="Motif de la demande *">
              <textarea
                required
                rows={3}
                placeholder="Exemple : la fiche contient des informations erronées / l'entreprise est radiée / motif RGPD spécifique"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-transparent border border-border rounded-md px-3 py-2 outline-none focus:border-purple-500"
              />
            </Field>

            <Field label="Justificatif de qualité (vous représentez l'entreprise)">
              <textarea
                rows={2}
                placeholder="Email professionnel sur le domaine de l'entreprise / lien LinkedIn directeur / Kbis / autre preuve"
                value={proof}
                onChange={(e) => setProof(e.target.value)}
                className="w-full bg-transparent border border-border rounded-md px-3 py-2 outline-none focus:border-purple-500"
              />
            </Field>

            {err && (
              <div className="rounded-md border border-red-500 bg-red-500/10 p-3 text-sm text-red-400">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-md font-medium disabled:opacity-50"
            >
              {loading ? "Envoi…" : "Envoyer la demande"}
            </button>

            <p className="text-xs text-muted-foreground">
              Nous ne stockons pas plus que les informations strictement nécessaires au
              traitement de votre demande, conformément au principe de minimisation RGPD.
              Délai de réponse : sous 30 jours ouvrés. Pour toute question :
              dpo@gapup.io.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm">{label}</span>
      {children}
    </label>
  );
}
