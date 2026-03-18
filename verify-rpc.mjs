const BOLIS_MINT = "612nt4GcdZn7onjK7fY9QQuqF7FVTarNHPszBHJ8T5ha";
const API_KEY = "8c199f4f-15aa-4a95-a084-1f6b18277d86";
const URL = `https://mainnet.helius-rpc.com/?api-key=${API_KEY}`;

async function verify() {
  try {
    const response = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [BOLIS_MINT]
      })
    });
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error completo:", error);
  }
}

verify();
