const API_URL = process.env.NEXUS_API_URL || 'http://localhost:8000';

async function getJson(path) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) {
    throw new Error(`API ${response.status}`);
  }
  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const [status, opportunities, trades] = await Promise.all([
      getJson('/api/v1/status'),
      getJson('/api/v1/opportunities?limit=10'),
      getJson('/api/v1/trades?limit=10'),
    ]);
    return res.status(200).json({ online: true, status, opportunities, trades });
  } catch (error) {
    return res.status(503).json({
      online: false,
      error: 'NEXUS API is unavailable',
      status: null,
      opportunities: [],
      trades: [],
    });
  }
}
