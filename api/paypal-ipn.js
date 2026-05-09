const { registerInSheet } = require('./utils/sheets');

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const BASE_URL = 'https://api-m.paypal.com';

async function getAccessToken() {
  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const data = await res.json();
  return data.access_token;
}

async function getSubscriptionDetails(subscriptionId, token) {
  const res = await fetch(`${BASE_URL}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res.json();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const event = req.body;
    console.log('PayPal webhook event:', event.event_type);

    // Eventos que nos interesan
    const relevantEvents = [
      'BILLING.SUBSCRIPTION.ACTIVATED',  // suscripción nueva activada
      'PAYMENT.SALE.COMPLETED',           // pago recibido (renovación)
    ];

    if (!relevantEvents.includes(event.event_type)) {
      return res.status(200).end();
    }

    const token = await getAccessToken();

    let subscriptionId, email, plan;

    if (event.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      subscriptionId = event.resource?.id;
      const sub = await getSubscriptionDetails(subscriptionId, token);
      email = sub.subscriber?.email_address;
      const planId = sub.plan_id;
      plan = planId === process.env.PAYPAL_PLAN_ANNUAL ? 'annual' : 'monthly';

    } else if (event.event_type === 'PAYMENT.SALE.COMPLETED') {
      subscriptionId = event.resource?.billing_agreement_id;
      if (!subscriptionId) return res.status(200).end();
      const sub = await getSubscriptionDetails(subscriptionId, token);
      email = sub.subscriber?.email_address;
      const planId = sub.plan_id;
      plan = planId === process.env.PAYPAL_PLAN_ANNUAL ? 'annual' : 'monthly';
    }

    if (email) {
      await registerInSheet(email, plan);
      console.log(`✅ Premium registrado: ${email} — ${plan}`);
    }

    return res.status(200).end();
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(200).end();
  }
};
