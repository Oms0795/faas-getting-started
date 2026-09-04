const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tron&vs_currencies=usd&include_24hr_change=true';

export default async function handler(req, res) {
  try {
    const apiRes = await fetch(COINGECKO_URL);
    if (!apiRes.ok) throw new Error('CoinGecko error');
    const data = await apiRes.json();
    const prices = {
      BTC: {
        price: data.bitcoin?.usd ?? null,
        change: data.bitcoin?.usd_24h_change ?? null,
      },
      ETH: {
        price: data.ethereum?.usd ?? null,
        change: data.ethereum?.usd_24h_change ?? null,
      },
      TRON: {
        price: data.tron?.usd ?? null,
        change: data.tron?.usd_24h_change ?? null,
      },
    };
    return res.status(200).json({ prices });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
