const { google } = require('googleapis');
const { registerInSheet } = require('./utils/sheets'); // ← agrega esto

// borra getSheetClient de aquí, ya está en utils/sheets.js

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

    await registerInSheet(email, plan); // ← reemplaza toda la lógica de sheets

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('register-premium error:', error);
    return res.status(500).json({ error: 'Error interno', detail: error.message });
  }
};
