// @ts-ignore: Deno import
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// @ts-ignore: Deno global
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")

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
    const { to, subject, html } = await req.json()
    
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set")
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'workflow@resend.dev',
        to: [to],
        subject,
        html
      })
    })

    const data = await res.json()

    if (res.ok) {
      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' },
        status: 200,
      })
    } else {
      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' },
        status: 400,
      })
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' },
      status: 500,
    })
  }
})
