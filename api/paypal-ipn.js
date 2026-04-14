const { google } = require('googleapis');
const https = require('https');
const querystring = require('querystring');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

async function getSheetClient() {
  const auth = new google.auth.JWT(
    SERVICE_ACCOUNT_EMAIL,
    null,
    PRIVATE_KEY,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  return google.sheets({ version: 'v4', auth });
}

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

async function registerInSheet(email, plan) {
  const sheets = await getSheetClient();
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Sheet1!A:A',
  });

  const rows = existing.data.values || [];
  const rowIndex = rows.findIndex(row => row[0]?.toLowerCase() === normalizedEmail);
  const expiry = plan === 'annual'
    ? Date.now() + 365 * 24 * 60 * 60 * 1000
    : Date.now() + 30 * 24 * 60 * 60 * 1000;

  if (rowIndex > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Sheet1!B${rowIndex + 1}:D${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[plan, new Date().toISOString(), expiry.toString()]] }
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:D',
      valueInputOption: 'RAW',
      requestBody: { values: [[normalizedEmail, plan, new Date().toISOString(), expiry.toString()]] }
    });
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // Leer body raw
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString();
    const params = querystring.parse(rawBody);

    // Verificar con PayPal
    const verified = await verifyWithPayPal(rawBody);
    if (!verified) {
      console.log('IPN no verificado');
      return res.status(200).end();
    }

    // Solo procesar pagos completados
    if (params.payment_status !== 'Completed') {
      return res.status(200).end();
    }

    const email = params.payer_email;
    const itemName = params.item_name || '';

    // Detectar plan según item_name
    const plan = itemName.toLowerCase().includes('annual') ? 'annual' : 'monthly';

    if (email) {
      await registerInSheet(email, plan);
      console.log(`Premium registrado: ${email} — ${plan}`);
    }

    return res.status(200).end();
  } catch (error) {
    console.error('IPN error:', error);
    return res.status(200).end(); // PayPal requiere 200 siempre
  }
};
