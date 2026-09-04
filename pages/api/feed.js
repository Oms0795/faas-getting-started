const ETHERSCAN_API = 'https://api.etherscan.io/v2/api';
const CHAIN_ID = '1';
const TOKEN_LIST_URL = 'https://tokens.coingecko.com/ethereum/all.json';
const TRANSFER_TOPIC0 = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

let tokenCache = null;
let tokenCacheAt = 0;

async function loadTokens() {
  const now = Date.now();
  if (tokenCache && now - tokenCacheAt < 30 * 60 * 1000) {
    return tokenCache;
  }
  try {
    const res = await fetch(TOKEN_LIST_URL);
    if (!res.ok) throw new Error('token list fetch failed');
    const data = await res.json();
    const map = {};
    for (const t of data.tokens || []) {
      if (t.address) {
        map[t.address.toLowerCase()] = {
          symbol: t.symbol,
          decimals: t.decimals ?? 18,
        };
      }
    }
    tokenCache = map;
    tokenCacheAt = now;
    return map;
  } catch (e) {
    // fallback básico si falla la lista
    return {};
  }
}

function parseHexUint(hex) {
  try {
    return BigInt(hex);
  } catch {
    return 0n;
  }
}

function formatUnits(value, decimals) {
  if (value === 0n) return '0';
  const base = 10n ** BigInt(decimals);
  const int = value / base;
  const rem = value % base;
  const remStr = rem.toString().padStart(decimals, '0').replace(/0+$/, '');
  if (!remStr) return int.toString();
  return `${int}.${remStr}`;
}

function compactValue(value, decimals) {
  const raw = formatUnits(value, decimals);
  const [int, dec] = raw.split('.');
  if (!dec) return int;
  const trimmed = dec.replace(/0+$/, '');
  if (!trimmed) return int;
  const short = trimmed.slice(0, 4);
  return `${int}.${short}`;
}

function hashToLatLon(hash) {
  const hex = hash.slice(2);
  const u1 = parseInt(hex.slice(0, 8), 16) / 0xffffffff;
  const u2 = parseInt(hex.slice(8, 16), 16) / 0xffffffff;
  const lat = Math.asin(2 * u2 - 1) * (180 / Math.PI);
  const lon = u1 * 360 - 180;
  return { lat, lon };
}

function addressFromTopic(topic) {
  if (!topic || topic.length < 42) return null;
  return '0x' + topic.slice(-40).toLowerCase();
}

function parseHexInt(hex) {
  try {
    return Number.parseInt(hex, 16);
  } catch {
    return 0;
  }
}

export default async function handler(req, res) {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ETHERSCAN_API_KEY not configured' });
  }

  try {
    const logsUrl =
      `${ETHERSCAN_API}?chainid=${CHAIN_ID}` +
      `&module=logs` +
      `&action=getLogs` +
      `&fromBlock=latest` +
      `&toBlock=latest` +
      `&topic0=${TRANSFER_TOPIC0}` +
      `&offset=40` +
      `&page=1` +
      `&apikey=${apiKey}`;

    const gasUrl =
      `${ETHERSCAN_API}?chainid=${CHAIN_ID}` +
      `&module=proxy` +
      `&action=eth_gasPrice` +
      `&apikey=${apiKey}`;

    const [logsRes, gasRes] = await Promise.all([fetch(logsUrl), fetch(gasUrl)]);
    const [logsData, gasData] = await Promise.all([logsRes.json(), gasRes.json()]);

    if (logsData.status !== '1' || !Array.isArray(logsData.result)) {
      return res.status(502).json({ error: 'Etherscan error', message: logsData.message || 'unknown' });
    }

    const tokens = await loadTokens();
    const events = [];

    for (const log of logsData.result) {
      if (!log.topics || log.topics.length < 3) continue;
      const address = log.address ? log.address.toLowerCase() : null;
      const from = addressFromTopic(log.topics[1]);
      const to = addressFromTopic(log.topics[2]);
      const value = parseHexUint(log.data);
      const tokenInfo = address ? tokens[address] : null;
      const decimals = tokenInfo ? tokenInfo.decimals : 18;
      const symbol = tokenInfo ? tokenInfo.symbol : address ? address.slice(0, 6) : '???';
      const amount = compactValue(value, decimals);
      const { lat, lon } = hashToLatLon(log.transactionHash || log.blockHash);

      events.push({
        id: `${log.transactionHash}-${log.logIndex}`,
        txHash: log.transactionHash,
        symbol: symbol.toUpperCase(),
        amount,
        from,
        to,
        token: address,
        lat,
        lon,
        createdAt: Date.now(),
      });
    }

    const gasPrice =
      gasData && gasData.result ? (parseHexInt(gasData.result) / 1e9).toFixed(2) : null;

    const firstLog = logsData.result[0] || {};
    const meta = {
      blockNumber: parseHexInt(firstLog.blockNumber) || null,
      timestamp: parseHexInt(firstLog.timeStamp) || null,
      gasPrice,
    };

    return res.status(200).json({ events: events.slice(0, 30), meta });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
