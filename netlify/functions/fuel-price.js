// Proxies Bangchak retail fuel prices from fuelthai.com (unofficial, no direct-browser CORS)
// so the client app can auto-fill the fuel price field without a manual lookup.
export default async () => {
  try {
    const res = await fetch('https://www.fuelthai.com/api/prices', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RiderIncomeTracker/1.0)' }
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'upstream_error' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await res.json();
    const gasohol95 = data.prices?.find(p => p.name?.includes('Gasohol 95'));
    const gasohol91 = data.prices?.find(p => p.name?.includes('Gasohol 91'));
    const gasoholE20 = data.prices?.find(p => p.name?.includes('E20'));

    return new Response(JSON.stringify({
      date: data.date,
      source: data.source || 'Bangchak Corporation',
      gasohol95: gasohol95?.today ?? null,
      gasohol91: gasohol91?.today ?? null,
      gasoholE20: gasoholE20?.today ?? null
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=1800'
      }
    });
  } catch {
    return new Response(JSON.stringify({ error: 'fetch_failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
