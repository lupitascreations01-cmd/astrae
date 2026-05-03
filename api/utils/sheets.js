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

module.exports = { registerInSheet };
