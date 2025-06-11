import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { Club, User, ApiResponse, ParticipantRole } from '../_shared/types.ts'

// Define TypeScript interfaces for request and response
interface SignupRequest {
  email: string
  password: string
  data: {
    first_name: string
    last_name: string
    phone?: string
    birth_date?: string
    club_name?: string // Optional for club creation
    club_subdomain?: string // Optional for club creation
  }
}

interface SignupResponseData {
  user: {
    id: string
    email: string
    name: string
  }
  club?: Club
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Parse and validate request
    const requestData: SignupRequest = await req.json()
    
    if (!requestData.email || !requestData.password) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email and password are required' 
        } as ApiResponse<null>),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // 3. Check if user already exists
    const { data: existingUser, error: userError } = await supabaseClient.auth.admin.listUsers({
      filter: {
        email: requestData.email
      }
    })
    
    if (userError) throw userError
    
    if (existingUser?.users && existingUser.users.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'User already exists' 
        } as ApiResponse<null>),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Create new user
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email: requestData.email,
      password: requestData.password,
      options: {
        data: {
          ...requestData.data,
          full_name: `${requestData.data.first_name} ${requestData.data.last_name}`,
          role: ParticipantRole.ADMIN // Default role for this signup endpoint
        }
      }
    })

    if (authError) throw authError

    // 5. If club creation data is provided, create a new club
    let clubData: Club | undefined = undefined
    if (requestData.data.club_name && requestData.data.club_subdomain) {
      // Check if subdomain is available
      const { data: existingClub } = await supabaseClient
        .from('clubs')
        .select('id')
        .eq('subdomain', requestData.data.club_subdomain)
        .single()

      if (existingClub) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Club subdomain already taken' 
          } as ApiResponse<null>),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create new club
      const { data: newClub, error: clubError } = await supabaseClient
        .from('clubs')
        .insert({
          name: requestData.data.club_name,
          subdomain: requestData.data.club_subdomain,
          created_by: authData.user?.id,
          onboarding_completed: false
        })
        .select()
        .single()

      if (clubError) throw clubError
      clubData = newClub

      // Add user as club admin
      const { error: memberError } = await supabaseClient
        .from('club_members')
        .insert({
          club_id: newClub.id,
          user_id: authData.user?.id,
          role: ParticipantRole.ADMIN
        })

      if (memberError) throw memberError
    }

    // 6. Return successful response
    const responseData: SignupResponseData = {
      user: {
        id: authData.user?.id ?? '',
        email: authData.user?.email ?? '',
        name: authData.user?.user_metadata?.full_name ?? ''
      },
      club: clubData
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: responseData
      } as ApiResponse<SignupResponseData>),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    // 7. Handle errors
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      } as ApiResponse<null>),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})