const https = require('https');
const querystring = require('querystring');
const { registerInSheet } = require('./utils/sheets');

function verifyWithPayPal(body) {
  return new Promise((resolve) => {
    const verifyBody = 'cmd=_notify-validate&' + body;
    const options = {
      hostname: 'ipnpb.paypal.com',
      path: '/cgi-bin/webscr',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(verifyBody)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data === 'VERIFIED'));
    });
    req.on('error', () => resolve(false));
    req.write(verifyBody);
    req.end();
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString();
    const params = querystring.parse(rawBody);

    const verified = await verifyWithPayPal(rawBody);
    if (!verified) {
      console.log('IPN no verificado');
      return res.status(200).end();
    }

    if (params.payment_status !== 'Completed') {
      return res.status(200).end();
    }

    const email = params.payer_email;
    const itemName = params.item_name || '';
    const plan = itemName.toLowerCase().includes('annual') ? 'annual' : 'monthly';

    if (email) {
      await registerInSheet(email, plan);
      console.log(`Premium registrado (PayPal): ${email} — ${plan}`);
    }

    return res.status(200).end();
  } catch (error) {
    console.error('IPN error:', error);
    return res.status(200).end();
  }
};
