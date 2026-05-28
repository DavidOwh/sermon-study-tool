export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { prompt } = await req.json();
  if (!prompt) return new Response('No prompt', { status: 400 });

  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const geminiRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 2000, temperature: 0.7 }
    })
  });

  if (!geminiRes.ok) {
    const err = await geminiRes.text();
    return new Response(`data: ${JSON.stringify({ error: err })}\n\ndata: [DONE]\n\n`, {
      headers: { 'Content-Type': 'text/event-stream' }
    });
  }

  const result = await geminiRes.json();
  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.';

  const encoder = new TextEncoder();
  const chunkSize = 100;
  const readable = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < text.length; i += chunkSize) {
        const chunk = text.slice(i, i + chunkSize);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    }
  });
}
