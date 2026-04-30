export default function PrivacyPage() {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#090909',
      color: '#f0f0f0',
      fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, sans-serif',
      maxWidth: 430,
      margin: '0 auto',
      padding: '28px 20px',
    }}>
      <a href="/profile" style={{ color: '#b8b8b8', fontSize: 13, textDecoration: 'none' }}>
        Back
      </a>

      <h1 style={{ fontSize: 28, lineHeight: 1.1, margin: '24px 0 12px' }}>
        Privacy Policy
      </h1>

      <p style={{ color: '#b8b8b8', fontSize: 14, lineHeight: 1.7 }}>
        LazyFit is currently in private beta. We store the account, profile,
        workout, weight, and food logging data needed to run the app.
      </p>

      <p style={{ color: '#b8b8b8', fontSize: 14, lineHeight: 1.7 }}>
        We do not sell personal data. Food AI inputs may be sent to our AI
        provider only to analyze the meal you submit. Barcode lookups may use
        Open Food Facts.
      </p>

      <p style={{ color: '#b8b8b8', fontSize: 14, lineHeight: 1.7 }}>
        For beta support or data removal requests, contact the LazyFit team
        directly.
      </p>
    </main>
  )
}
