module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { feedback, lang, ts } = req.body;
    if (!feedback || feedback.trim().length < 2) {
      return res.status(400).json({ error: 'Feedback vacío' });
    }

    // Registrar en PostHog como evento (reutiliza la misma clave del frontend)
    await fetch('https://us.i.posthog.com/capture/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: 'phc_xU23h4XkWh9qzLJiCaKgA6TWbQ4f9CFWVXrzLb8BrFbE',
        event: 'negative_feedback_submitted',
        properties: {
          feedback: feedback.trim(),
          lang: lang || 'es',
          ts: ts || new Date().toISOString(),
          source: 'review_prompt'
        }
      })
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    // Falla silenciosa — no bloquear la UX por esto
    return res.status(200).json({ ok: true });
  }
};
