const rateLimitMap = new Map();
const RATE_LIMIT = 20;
const WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  rateLimitMap.set(ip, entry);
  return true;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta más tarde.' });
  }

  const { type, planetA, signA, nameA, nameB, chartSummary, question, lang } = req.body;

  if (!type) return res.status(400).json({ error: 'Missing type' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const isES = lang !== 'en';
  let prompt = '';
  let maxTokens = 300;

  if (type === 'chiron') {
    prompt = isES
      ? `Eres una astróloga experta en sinastría. Escribe una interpretación de Quirón en ${signA} para la relación entre ${nameA} y ${nameB}.\n\nEscribe exactamente 3 párrafos cortos (2-3 oraciones cada uno). Habla sobre: la herida kármica que este Quirón trae a la relación, el potencial de sanación que ofrece esta conexión, y cómo afecta la dinámica entre ellos. Tono poético y empático. Solo párrafos, sin listas. Segunda persona plural (ustedes). Máximo 120 palabras.`
      : `You are an expert synastry astrologer. Write a Chiron in ${signA} interpretation for the relationship between ${nameA} and ${nameB}.\n\nWrite exactly 3 short paragraphs (2-3 sentences each). Cover: the karmic wound this Chiron brings to the relationship, the healing potential this connection offers, and how it affects their dynamic. Poetic and empathetic tone. Paragraphs only, no lists. Second person plural (you both). Maximum 120 words.`;

  } else if (type === 'northnode') {
    prompt = isES
      ? `Eres una astróloga experta en sinastría. Escribe una interpretación del Nodo Norte en ${signA} para la relación entre ${nameA} y ${nameB}.\n\nEscribe exactamente 3 párrafos cortos (2-3 oraciones cada uno). Habla sobre: el propósito kármico compartido, hacia dónde les llama el alma a crecer juntos, y qué patrones del pasado deben soltar. Tono esperanzador y místico. Solo párrafos, sin listas. Segunda persona plural (ustedes). Máximo 120 palabras.`
      : `You are an expert synastry astrologer. Write a North Node in ${signA} interpretation for the relationship between ${nameA} and ${nameB}.\n\nWrite exactly 3 short paragraphs (2-3 sentences each). Cover: the shared karmic purpose, where the soul calls them to grow together, and what past patterns to release. Hopeful and mystical tone. Paragraphs only, no lists. Second person plural (you both). Maximum 120 words.`;

  } else if (type === 'planet') {
    prompt = isES
      ? `Eres una astróloga experta. Escribe una interpretación personal de ${planetA} en ${signA} para ${nameA}.\n\nEscribe 2 párrafos cortos (2-3 oraciones cada uno). Habla sobre cómo esta posición se expresa en su personalidad y relaciones, con fortalezas específicas y áreas de crecimiento. Tono cálido y personal. Solo párrafos. Segunda persona singular (tú). Máximo 80 palabras.`
      : `You are an expert astrologer. Write a personal interpretation of ${planetA} in ${signA} for ${nameA}.\n\nWrite 2 short paragraphs (2-3 sentences each). Cover how this position expresses itself in their personality and relationships, with specific strengths and growth areas. Warm and personal tone. Paragraphs only. Second person singular (you). Maximum 80 words.`;

  } else if (type === 'monthForecast') {
    maxTokens = 320;
    const bestWindows = chartSummary || '';
    const tenseWindow = question || '';
    prompt = isES
      ? `Eres una astróloga experta en sinastría, escribiendo una predicción mensual para la pareja formada por ${nameA} y ${nameB}.\n\nDatos de tránsitos calculados para los próximos 30 días:\n- Ventanas favorables (Luna/Venus en buen aspecto con la carta de alguno de los dos): ${bestWindows || 'ninguna destacada'}\n- Ventana de tensión a cuidar: ${tenseWindow || 'ninguna relevante'}\n\nEscribe una predicción de vínculo para los próximos 30 días, en 3 párrafos cortos (2-3 oraciones cada uno):\n1) Tono general del mes para la relación.\n2) Menciona de forma natural (sin listas, dentro de la prosa) las fechas favorables y qué las hace especiales para ellos como pareja.\n3) Si hay ventana de tensión, menciónala con un consejo concreto y breve; si no hay, cierra con una recomendación general para aprovechar el mes.\n\nTono cálido, cercano, como una carta astral personal. Segunda persona plural (ustedes). Solo párrafos, sin listas ni títulos. Máximo 150 palabras.`
      : `You are an expert synastry astrologer writing a monthly forecast for the couple formed by ${nameA} and ${nameB}.\n\nTransit data calculated for the next 30 days:\n- Favorable windows (Moon/Venus in good aspect to either natal chart): ${bestWindows || 'none standout'}\n- Tension window to watch: ${tenseWindow || 'none relevant'}\n\nWrite a bond forecast for the next 30 days, in 3 short paragraphs (2-3 sentences each):\n1) General mood of the month for the relationship.\n2) Naturally mention (no lists, within the prose) the favorable dates and what makes them special for them as a couple.\n3) If there's a tension window, mention it with one concrete, brief piece of advice; if not, close with a general recommendation to make the most of the month.\n\nWarm, close tone, like a personal astrology letter. Second person plural (you both). Paragraphs only, no lists or headings. Maximum 150 words.`;

  } else if (type === 'freeQuestion') {
    maxTokens = 400;
    prompt = isES
      ? `Eres una astróloga experta y empática. Tienes la carta natal de ${nameA} frente a ti: ${chartSummary}.\n\n${nameA} te pregunta: "${question}"\n\nResponde directamente a su pregunta basándote en su carta natal. Sé específica, menciona los planetas relevantes. Tono cálido y accesible. Máximo 180 palabras. Solo párrafos, sin listas ni títulos.`
      : `You are an expert and empathetic astrologer. You have ${nameA}'s natal chart: ${chartSummary}.\n\n${nameA} asks: "${question}"\n\nAnswer directly based on their natal chart. Be specific, mention relevant planets. Warm and accessible tone. Maximum 180 words. Paragraphs only, no lists or headings.`;

  } else {
    return res.status(400).json({ error: 'Invalid type' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Anthropic error:', JSON.stringify(err));
      return res.status(502).json({ error: 'AI service error', detail: err.error?.message || '' });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    return res.status(200).json({ interpretation: text });

  } catch (err) {
    console.error('interpret.js error:', err.message);
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
};
