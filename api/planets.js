export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date required' });

  const [y, m, d] = date.split('-');
  const dateStr = `${y}-${m}-${d}`;

  const planets = {
    Sun: '10', Moon: '301', Mercury: '199', Venus: '299',
    Mars: '499', Jupiter: '599', Saturn: '699',
    Uranus: '799', Neptune: '899', Pluto: '999'
  };

  try {
    const results = {};
    await Promise.all(Object.entries(planets).map(async ([name, id]) => {
      const url = `https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='${id}'&OBJ_DATA='NO'&MAKE_EPHEM='YES'&EPHEM_TYPE='OBSERVER'&CENTER='500@399'&START_TIME='${dateStr}'&STOP_TIME='${dateStr} 23:59'&STEP_SIZE='1d'&QUANTITIES='31'`;
      const r = await fetch(url);
      const data = await r.json();
      const match = data.result.match(/\d{4}-\w{3}-\d{2}\s+[\d:]+\s+([\d.]+)/);
      if (match) results[name] = parseFloat(match[1]);
    }));
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
