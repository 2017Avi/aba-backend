const https = require('https');
const http = require('http');

const PORT = process.env.PORT || 3000;

function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.writeHead(200); res.end(); return;
  }

  if (req.method !== 'POST' || req.url !== '/claude') {
    res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.writeHead(500); res.end(JSON.stringify({ error: 'API key not configured' })); return;
  }

  let rawBody = '';
  req.on('data', chunk => rawBody += chunk);
  req.on('end', () => {
    let body;
    try { body = JSON.parse(rawBody); }
    catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid JSON' })); return; }

    const payload = JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: body.system || '',
      messages: body.messages || []
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      timeout: 55000,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload, 'utf8')
      }
    };

    const apiReq = https.request(options, (apiRes) => {
      const chunks = [];
      apiRes.on('data', chunk => chunks.push(chunk));
      apiRes.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          const parsed = JSON.parse(raw);
          res.writeHead(apiRes.statusCode);
          res.end(JSON.stringify(parsed));
        } catch(e) {
          res.writeHead(500); res.end(JSON.stringify({ error: 'Parse error' }));
        }
      });
    });

    apiReq.on('timeout', () => {
      apiReq.destroy();
      res.writeHead(504); res.end(JSON.stringify({ error: 'Timeout' }));
    });

    apiReq.on('error', (e) => {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    });

    apiReq.write(payload, 'utf8');
    apiReq.end();
  });
}

http.createServer(handleRequest).listen(PORT, () => {
  console.log(`ABA backend running on port ${PORT}`);
});
