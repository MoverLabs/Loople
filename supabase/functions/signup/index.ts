import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Define TypeScript interfaces for request and response
interface SignupRequest {
  email: string
  password: string
  data: {
    first_name: string
    last_name: string
    phone?: string
    birth_date?: string
  }
}


interface SignupResponse {
  success: boolean
  user?: any
  error?: string
}

serve(async (req: Request) => {
  try {
    // 1. Parse and validate request
    const requestData: SignupRequest = await req.json()
    
    if (!requestData.email || !requestData.password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email and password are required' } as SignupResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 2. Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // 3. Check if user already exists
    const { data: existingUser } = await supabaseClient.auth.admin.getUserByIdentifier(
      requestData.email
    )
    
    if (existingUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'User already exists' } as SignupResponse),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
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
          role: 'admin' // Default role for this signup endpoint
        }
      }
    })

    if (authError) throw authError

    // 5. Return successful response
    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: authData.user?.id,
          email: authData.user?.email,
          name: authData.user?.user_metadata?.full_name
        }
      } as SignupResponse),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    // 6. Handle errors
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      } as SignupResponse),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})