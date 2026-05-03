const crypto = require('crypto');
const { registerInSheet } = require('./utils/sheets');

const LEMON_WEBHOOK_SECRET = process.env.LEMON_WEBHOOK_SECRET;

function verifySignature(rawBody, signature) {
  const hmac = crypto.createHmac('sha256', LEMON_WEBHOOK_SECRET);
  hmac.update(rawBody);
  const digest = hmac.digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(digest),
    Buffer.from(signature)
  );
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString();

    // Verificar firma
    const signature = req.headers['x-signature'];
    if (!signature || !verifySignature(rawBody, signature)) {
      console.log('Firma inválida');
      return res.status(401).end();
    }

    const payload = JSON.parse(rawBody);
    const eventName = payload.meta?.event_name;

    // Solo procesar suscripciones activas
    if (eventName !== 'subscription_created' && eventName !== 'subscription_payment_success') {
      return res.status(200).end();
    }

    const email = payload.data?.attributes?.user_email;
    const variantName = payload.data?.attributes?.variant_name || '';
    const plan = variantName.toLowerCase().includes('annual') ? 'annual' : 'monthly';

    if (email) {
      await registerInSheet(email, plan);
      console.log(`Premium registrado (Lemon): ${email} — ${plan}`);
    }

    return res.status(200).end();
  } catch (error) {
    console.error('Lemon webhook error:', error);
    return res.status(500).end();
  }
};
