const { google } = require('googleapis');

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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    const sheets = await getSheetClient();
    const normalizedEmail = email.toLowerCase().trim();

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:D',
    });

    const rows = result.data.values || [];
    // Saltar fila de encabezados
    const dataRows = rows.slice(1);
    const userRow = dataRows.find(row => row[0]?.toLowerCase() === normalizedEmail);

    if (!userRow) {
      return res.status(200).json({ premium: false, reason: 'not_found' });
    }

    const expiry = parseInt(userRow[3]);
    const now = Date.now();

    if (expiry && now > expiry) {
      return res.status(200).json({ premium: false, reason: 'expired' });
    }

    return res.status(200).json({
      premium: true,
      plan: userRow[1],
      expiry: expiry
    });

  } catch (error) {
    console.error('verify-premium error:', error);
    return res.status(500).json({ error: 'Error interno', detail: error.message });
  }
};
