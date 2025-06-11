import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface ClubData {
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

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the user from the auth token
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get request body
    const requestData: ClubData = await req.json()

    // Validate required fields
    const requiredFields = [
      'name',
      'subdomain',
      'description',
      'contact_email',
      'contact_phone',
      'address',
      'city',
      'state',
      'zip_code',
      'owner_id',
    ]

    for (const field of requiredFields) {
      if (!requestData[field as keyof ClubData]) {
        return new Response(
          JSON.stringify({ error: `Missing required field: ${field}` }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(requestData.contact_email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate phone format (basic validation)
    const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/
    if (!phoneRegex.test(requestData.contact_phone)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone format. Use format: (XXX) XXX-XXXX' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if subdomain is already taken
    const { data: existingClub, error: subdomainError } = await supabaseClient
      .from('clubs')
      .select('id')
      .eq('subdomain', requestData.subdomain)
      .single()

    if (subdomainError && subdomainError.code !== 'PGRST116') {
      return new Response(
        JSON.stringify({ error: 'Error checking subdomain availability' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (existingClub) {
      return new Response(
        JSON.stringify({ error: 'Subdomain already taken' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create the club
    const { data: club, error: createError } = await supabaseClient
      .from('clubs')
      .insert([
        {
          ...requestData,
          onboarding_completed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single()

    if (createError) {
      return new Response(
        JSON.stringify({ error: 'Error creating club' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(
      JSON.stringify({ data: club }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}) 