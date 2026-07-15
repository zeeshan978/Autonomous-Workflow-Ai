// @ts-expect-error: Deno import
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// @ts-expect-error: Deno global
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  try {
    const { action, payload } = await req.json()
    
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ simulated: true }), {
        headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' },
        status: 200,
      })
    }

    // Call Gemini REST API directly
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    
    let contents: any[] = [];
    if (action === 'generateWorkflow') {
      contents = [
        { role: 'user', parts: [{ text: payload.systemPrompt }] },
        { role: 'user', parts: [{ text: `Generate a workflow for: ${payload.userPrompt}` }] }
      ];
    } else if (action === 'chat') {
      contents = payload.context 
        ? [{ role: 'user', parts: [{ text: `Context: ${payload.context}\n\nUser: ${payload.message}` }] }]
        : [{ role: 'user', parts: [{ text: payload.message }] }];
    } else if (action === 'analyze') {
      contents = [{ role: 'user', parts: [{ text: `Analyze the following data and ${payload.prompt}. Data: ${JSON.stringify(payload.data, null, 2)}` }] }];
    } else if (action === 'summarize') {
      contents = [{ role: 'user', parts: [{ text: `Summarize the following text concisely:\n\n${payload.text}` }] }];
    } else if (action === 'optimize') {
      contents = [{ role: 'user', parts: [{ text: `Optimize this workflow for better efficiency and reliability. Return the same JSON structure:\n\n${JSON.stringify(payload.workflow)}` }] }];
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    const data = await res.json();
    
    let text = '';
    if (data.candidates && data.candidates.length > 0) {
      text = data.candidates[0].content.parts.map((p: any) => p.text).join('');
    } else if (data.error) {
      throw new Error(data.error.message || 'Gemini API Error');
    }

    return new Response(JSON.stringify({ text }), {
      headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' },
      status: 500,
    })
  }
})

