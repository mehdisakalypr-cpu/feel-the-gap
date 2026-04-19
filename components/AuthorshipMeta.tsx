import Script from 'next/script'

const OWNER_EMAIL = 'mehdi.sakalypr@gmail.com'
const OWNER_NAME = 'Mehdi Sakaly'
const PROJECT_FINGERPRINT_FTG = '66d440006ffee21786ba79e378cd021a'

export default function AuthorshipMeta() {
  const year = new Date().getFullYear()
  const banner = `© 2025-${year} ${OWNER_NAME} — Feel The Gap · fp:${PROJECT_FINGERPRINT_FTG}`
  const script = "try{console.log('%c" + banner + "','color:#C9A84C;font-weight:700');}catch(_){}"
  return (
    <>
      <meta name="author" content={OWNER_NAME} />
      <meta name="x-authorship-owner" content={OWNER_EMAIL} />
      <meta name="x-authorship-fingerprint" content={PROJECT_FINGERPRINT_FTG} />
      <meta name="x-authorship-license" content="LicenseRef-Proprietary-Sakaly" />
      <meta name="x-authorship-notice" content="Conception & direction : Mehdi Sakaly. Reproduction non autorisee interdite." />
      <Script id="authorship-banner" strategy="afterInteractive">{script}</Script>
    </>
  )
}
