import Link from 'next/link'

export const dynamic = 'force-static'
export const revalidate = 86400

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-invert prose-sm">
        <Link href="/legal" className="text-[#C9A84C] text-sm hover:underline no-underline">← Retour</Link>

        <h1>Mentions légales / Legal Notice</h1>
        <p className="text-gray-400 text-sm">
          Dernière mise à jour : avril 2026 · Bilingue FR/EN · Valide sous réserve d&apos;actualisation périodique.
        </p>

        <h2>1. Éditeur du site — Publisher</h2>
        <p>
          Le site <strong>feelthegap.world</strong> (et ses sous-domaines) est édité par <strong>OFA Holdings LLC</strong>,
          d/b/a <strong>Feel The Gap</strong>, société à responsabilité limitée de droit de l&apos;État du Wyoming (USA).<br />
          Siège social : 30 N Gould St, Ste R, Sheridan, WY 82801, USA.
        </p>
        <p className="text-xs text-gray-400">
          En phase d&apos;amorçage précédant l&apos;effectivité complète de l&apos;enregistrement Wyoming, certains contrats
          peuvent être émis au nom de Mehdi Sakaly (auteur, France) puis transférés automatiquement à l&apos;entité
          américaine dès mise en place.
        </p>

        <h2>2. Directeur de la publication</h2>
        <p>Mehdi Sakaly — Managing Member · contact : <strong>legal@feelthegap.world</strong>.</p>

        <h2>3. Contact</h2>
        <ul>
          <li>Support : <strong>support@feelthegap.world</strong></li>
          <li>Juridique / privacy : <strong>legal@feelthegap.world</strong></li>
          <li>Signalement abus / DMCA : <strong>abuse@feelthegap.world</strong></li>
        </ul>

        <h2>4. Hébergement</h2>
        <p>
          Site hébergé par <strong>Vercel Inc.</strong>, 340 S Lemon Ave #4133, Walnut, CA 91789, USA.<br />
          Base de données : <strong>Supabase Inc.</strong>, Singapore.<br />
          Paiements : <strong>Stripe Payments Europe, Ltd.</strong> (UE) / <strong>Stripe Inc.</strong> (US).
        </p>

        <h2>5. Propriété intellectuelle</h2>
        <p>
          L&apos;ensemble des éléments figurant sur le site (textes, graphismes, logiciels, photographies, images,
          plans, logos, marques, créations) est la propriété exclusive de l&apos;éditeur ou de ses partenaires. Toute
          représentation totale ou partielle par quelque procédé que ce soit, sans autorisation expresse, est
          interdite et constitue une contrefaçon sanctionnée par les articles L.335-2 et suivants du Code de la
          propriété intellectuelle.
        </p>

        <h2 id="authorship">5 bis. Traçabilité technique & déclaration d&apos;auteur</h2>
        <p>
          Le logiciel sous-jacent (code source, architecture, spécifications, workflows agents, prompts et modèle
          économique) a été conçu, spécifié et dirigé par <strong>Mehdi Sakaly</strong>, titulaire exclusif des droits
          patrimoniaux et moraux. La participation ponctuelle d&apos;outils d&apos;assistance à la rédaction (modèles
          Claude, Anthropic PBC) s&apos;effectue sous direction exclusive de l&apos;Auteur, sans transfert de droit,
          conformément aux recommandations WIPO et USPTO relatives aux œuvres assistées par IA.
        </p>
        <p className="text-xs text-gray-400">
          Preuves techniques déposées : manifeste SHA-256 du corpus source
          (<Link href="/api/_authorship" className="text-[#C9A84C]">/api/_authorship</Link>), fingerprint projet
          <code className="text-[#C9A84C]">66d440006ffee21786ba79e378cd021a</code>, horodatage blockchain Bitcoin via
          OpenTimestamps (hash <code className="text-[#C9A84C]">c43c7d569377f80b4126d0511e99fb90704a51f14bb7226fcea95353382d8da5</code>),
          <strong>dépôt INPI e-Soleau n°&nbsp;<code className="text-[#C9A84C]">DSO2026014334</code></strong>
          (France, déposé le 20/04/2026 à 09:12:00&nbsp;UTC, valide jusqu&apos;au 20/04/2031, empreinte
          package <code className="text-[#C9A84C]">ccb46a5b851a46209b95e7847b71b6aece792657684b37d356629d5b6846cc4b</code>).
          Licence propriétaire <code className="text-[#C9A84C]">LicenseRef-Proprietary-Sakaly</code>. Usage pour
          entraînement de modèles d&apos;apprentissage automatique <strong>explicitement interdit</strong>. En utilisant
          ce site, l&apos;utilisateur s&apos;engage à respecter les présentes mentions et les
          <Link href="/legal/cgu" className="text-[#C9A84C]"> conditions d&apos;utilisation</Link>.
        </p>

        <h2>6. Données personnelles</h2>
        <p>
          Voir <Link href="/legal/privacy">Politique de confidentialité</Link>. Conformément au RGPD (UE) 2016/679,
          vous disposez de droits d&apos;accès, rectification, effacement, portabilité, limitation et opposition.
        </p>

        <h2>7. Cookies</h2>
        <p>
          Voir <Link href="/legal/cookies">Politique cookies</Link>.
        </p>

        <h2>8. Responsabilité</h2>
        <p>
          L&apos;éditeur s&apos;efforce d&apos;assurer l&apos;exactitude des informations publiées mais ne peut garantir
          leur exhaustivité. Limites de responsabilité en <Link href="/legal/cgv">CGV §13</Link>.
        </p>

        <h2>9. Loi applicable — Juridiction</h2>
        <p>
          Présentes mentions régies par la loi de l&apos;État du Wyoming (USA), sans préjudice des droits impératifs
          des consommateurs UE/UK/Suisse.
        </p>

        <h2>10. Signalement de contenu illicite</h2>
        <p>
          DSA UE 2022/2065 / DMCA : <strong>abuse@feelthegap.world</strong> ou formulaire
          <Link href="/legal/dmca"> DMCA</Link>.
        </p>

        <hr />

        <h1>Legal Notice (English)</h1>
        <p>
          The website <strong>feelthegap.world</strong> is published by <strong>OFA Holdings LLC</strong> d/b/a
          <strong> Feel The Gap</strong>, a Wyoming limited liability company. Registered office: 30 N Gould St,
          Ste R, Sheridan, WY 82801, USA. Publication director: Mehdi Sakaly. Hosting: Vercel Inc. (California, USA).
          Contact: <strong>legal@feelthegap.world</strong>. Personal data handled per our
          <Link href="/legal/privacy"> Privacy Policy</Link>. IP ownership per
          <Link href="/legal/cgv"> Terms of Sale §10</Link>. Governing law: Wyoming, USA — EU/UK/Swiss consumers
          retain mandatory local forum and rights. Abuse / DMCA: <strong>abuse@feelthegap.world</strong>.
        </p>
      </div>
    </div>
  )
}
