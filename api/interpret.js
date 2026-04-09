export default async function handler(req, res) {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, planetA, signA, planetB, signB, nameA, nameB, lang } = req.body;

  if (!type) {
    return res.status(400).json({ error: 'Missing type' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Construir el prompt según el tipo de interpretación
  let prompt = '';
  const isES = lang !== 'en';

  if (type === 'chiron') {
    // Quirón en sinastría
    const sign = signA;
    if (isES) {
      prompt = `Eres una astróloga experta en sinastría. Escribe una interpretación de Quirón en ${sign} para una lectura de compatibilidad de pareja. 
      
La interpretación debe:
- Tener exactamente 3 párrafos cortos (2-3 oraciones cada uno)
- Hablar sobre la herida kármica que este Quirón representa en la relación
- El potencial de sanación que ofrece esta conexión
- Cómo este Quirón afecta la dinámica entre ${nameA} y ${nameB}
- Tono: poético, empático, profundo pero accesible
- NO usar listas ni bullets, solo párrafos fluidos
- Escribir en español, segunda persona plural (ustedes)
- Máximo 120 palabras en total`;
    } else {
      prompt = `You are an expert astrologer specializing in synastry. Write a Chiron in ${sign} interpretation for a compatibility reading between ${nameA} and ${nameB}.

The interpretation must:
- Have exactly 3 short paragraphs (2-3 sentences each)
- Address the karmic wound this Chiron represents in the relationship
- The healing potential this connection offers
- How this Chiron affects the dynamic between them
- Tone: poetic, empathetic, deep but accessible
- NO lists or bullets, only flowing paragraphs
- Write in English, second person plural (you both)
- Maximum 120 words total`;
    }

  } else if (type === 'northnode') {
    // Nodo Norte en sinastría
    const sign = signA;
    if (isES) {
      prompt = `Eres una astróloga experta en sinastría. Escribe una interpretación del Nodo Norte en ${sign} para una lectura de compatibilidad entre ${nameA} y ${nameB}.

La interpretación debe:
- Tener exactamente 3 párrafos cortos (2-3 oraciones cada uno)
- Hablar sobre el propósito kármico compartido de esta relación
- Hacia dónde les llama el alma a crecer juntos
- Qué patrones del pasado deben soltar para avanzar
- Tono: esperanzador, místico, inspirador
- NO usar listas ni bullets, solo párrafos fluidos
- Escribir en español, segunda persona plural (ustedes)
- Máximo 120 palabras en total`;
    } else {
      prompt = `You are an expert astrologer specializing in synastry. Write a North Node in ${sign} interpretation for a compatibility reading between ${nameA} and ${nameB}.

The interpretation must:
- Have exactly 3 short paragraphs (2-3 sentences each)
- Address the shared karmic purpose of this relationship
- Where the soul calls them to grow together
- What past patterns they must release to move forward
- Tone: hopeful, mystical, inspiring
- NO lists or bullets, only flowing paragraphs
- Write in English, second person plural (you both)
- Maximum 120 words total`;
    }

  } else if (type === 'planet') {
    // Interpretación de planeta individual en carta natal
    const planet = planetA;
    const sign = signA;
    if (isES) {
      prompt = `Eres una astróloga experta. Escribe una interpretación personal de ${planet} en ${sign} para ${nameA}.

La interpretación debe:
- Tener 2 párrafos cortos (2-3 oraciones cada uno)
- Hablar sobre cómo esta posición planetaria se expresa en la personalidad y relaciones de ${nameA}
- Mencionar fortalezas específicas y áreas de crecimiento
- Tono: cálido, personal, perspicaz — como una astróloga hablando directamente
- NO usar listas ni bullets, solo párrafos fluidos
- Escribir en español, segunda persona singular (tú)
- Máximo 80 palabras en total`;
    } else {
      prompt = `You are an expert astrologer. Write a personal interpretation of ${planet} in ${sign} for ${nameA}.

The interpretation must:
- Have 2 short paragraphs (2-3 sentences each)
- Address how this planetary position expresses itself in ${nameA}'s personality and relationships
- Mention specific strengths and growth areas
- Tone: warm, personal, insightful — like an astrologer speaking directly
- NO lists or bullets, only flowing paragraphs
- Write in English, second person singular (you)
- Maximum 80 words total`;
    }

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
        model: 'claude-haiku-4-5-20251001', // Haiku = más rápido y barato para interpretaciones cortas
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Anthropic error:', err);
      return res.status(502).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    return res.status(200).json({ interpretation: text });

  } catch (err) {
    console.error('interpret.js error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
