import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { Club, ApiResponse } from '../_shared/types.ts'

// Request type for club creation
interface CreateClubRequest {
  name: string
  subdomain: string
  description: string
  contact_email: string
  contact_phone: string
  address: string
  city: string
  state: string
  zip_code: string
  owner_id: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Get the path from the request URL
  const url = new URL(req.url)
  const path = url.pathname.split('/').pop()

  try {
    switch (path) {
      case 'join':
        const { default: joinHandler } = await import('./join.ts')
        return await joinHandler(req)
      default:
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid endpoint'
          } as ApiResponse<null>),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error'
      } as ApiResponse<null>),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}) 