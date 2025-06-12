import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { Club, User, ApiResponse, ParticipantRole, MemberType, MembershipStatus } from '../_shared/types.ts'

// Define TypeScript interfaces for request and response
interface SignupRequest {
  email: string
  password: string
  data: {
    first_name: string
    last_name: string
    phone?: string
    club_name: string // required for club creation
    club_subdomain: string // required for club creation
    birth_date?: string
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
    
    // Check if club name and subdomain are provided
    if (!requestData.data.club_name || !requestData.data.club_subdomain) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Club name and subdomain are required for signup' 
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
    const { data: existingUser, error: userError } = await supabaseClient
      .from('users')
      .select('id, email')
      .eq('email', requestData.email.trim().toLowerCase())
      .single()
    
    if (userError && userError.code !== 'PGRST116') { // PGRST116 is the "not found" error
      throw userError
    }
    
    if (existingUser) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `User with email ${requestData.email} already exists` 
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

    // 5. If club creation data is provided, create a new club first

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
        owner_id: authData.user?.id,
        onboarding_completed: false,
        created_at: new Date(),
        updated_at: new Date()
      })
      .select()
      .single()

    if (clubError) {
      console.error('Club creation error:', clubError)
      throw clubError
    }

    const clubData = newClub

    // Create user record in the public.users table
    const { error: dbUserError } = await supabaseClient
      .from('users')
      .insert({
        id: authData.user?.id, // This links to auth.users
        email: requestData.email,
        first_name: requestData.data.first_name,
        last_name: requestData.data.last_name,
        phone: requestData.data.phone,
        is_active: true,
        role_id: 1, // Default role ID for new users
        club_id: clubData.id, // club_id is now required
        created_at: new Date(),
        updated_at: new Date()
      })

    if (dbUserError) {
      console.error('Error creating user record:', dbUserError)
      throw dbUserError
    }

    // Add user as member if club was created
    if (clubData) {
      const { error: memberError } = await supabaseClient
        .from('members')
        .insert({
          club_id: clubData.id,
          user_id: authData.user?.id,
          first_name: requestData.data.first_name,
          last_name: requestData.data.last_name,
          email: requestData.email,
          phone: requestData.data.phone,
          date_of_birth: requestData.data.birth_date ? new Date(requestData.data.birth_date) : undefined,
          member_type: MemberType.INDIVIDUAL,
          created_at: new Date(),
          updated_at: new Date()
        })

      if (memberError) {
        console.error('Member creation error:', memberError)
        throw memberError
      }
    }

    // 6. Return successful response
    const responseData: SignupResponseData = {
      user: {
        id: authData.user?.id ?? '',
        email: authData.user?.email ?? '',
        name: authData.user?.user_metadata?.full_name ?? ''
      },
      club: clubData ? {
        id: clubData.id,
        name: clubData.name,
        subdomain: clubData.subdomain,
        created_at: clubData.created_at,
        updated_at: clubData.updated_at,
        onboarding_completed: clubData.onboarding_completed
      } : undefined
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