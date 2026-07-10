const API_URL = process.env.NEXUS_API_URL || 'http://localhost:8000';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/backtests/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(5000),
    });
    const payload = await response.json();
    return res.status(response.status).json(payload);
  } catch (error) {
    return res.status(503).json({ error: 'NEXUS API is unavailable' });
  }
}
