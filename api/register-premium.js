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
    const { email, plan } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    const sheets = await getSheetClient();
    const normalizedEmail = email.toLowerCase().trim();

    // Verificar si ya existe
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:A',
    });

    const rows = existing.data.values || [];
    const alreadyExists = rows.some(row => row[0]?.toLowerCase() === normalizedEmail);

    if (alreadyExists) {
      // Actualizar fecha de expiración
      const rowIndex = rows.findIndex(row => row[0]?.toLowerCase() === normalizedEmail);
      const expiry = plan === 'annual'
        ? Date.now() + 365 * 24 * 60 * 60 * 1000
        : Date.now() + 30 * 24 * 60 * 60 * 1000;

      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `Sheet1!B${rowIndex + 1}:D${rowIndex + 1}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[plan, new Date().toISOString(), expiry.toString()]]
        }
      });
    } else {
      // Agregar nuevo cliente
      const expiry = plan === 'annual'
        ? Date.now() + 365 * 24 * 60 * 60 * 1000
        : Date.now() + 30 * 24 * 60 * 60 * 1000;

      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: 'Sheet1!A:D',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[normalizedEmail, plan, new Date().toISOString(), expiry.toString()]]
        }
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('register-premium error:', error);
    return res.status(500).json({ error: 'Error interno', detail: error.message });
  }
};
