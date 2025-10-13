import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from './cors.ts'

// Common response type
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Common validation functions
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/
  return phoneRegex.test(phone)
}

export const validateRequiredFields = <T extends Record<string, any>>(
  data: T,
  requiredFields: readonly (keyof T)[]
): string | null => {
  for (const field of requiredFields) {
    if (!data[field]) {
      return `Missing required field: ${String(field)}`
    }
  }
  return null
}

// Create Supabase client with auth context
export const createSupabaseClient = (req: Request) => {
  const authHeader = req.headers.get('Authorization')
  
  if (!authHeader) {
    throw new Error('Authorization header is required')
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  
  console.log('Supabase Config:', { 
    url: supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    authHeader: authHeader
  })

  // Create client exactly as in join.ts
  return createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers: { Authorization: authHeader! },
      }
    }
  )
}

// Get authenticated user with error handling
export const getAuthUser = async (supabaseClient: any) => {
  try {
    console.log('Getting auth user...')
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()
    
    console.log('Auth User:', { 
      userId: user?.id, 
      userEmail: user?.email,
      userError: userError?.message 
    })

    if (userError) {
      console.error('Auth error:', userError)
      throw new Error('Authentication failed')
    }
    
    if (!user) {
      console.error('No user found')
      throw new Error('User not found')
    }
    
    console.log('Auth user found:', { id: user.id, email: user.email })
    return user
  } catch (error) {
    console.error('Error in getAuthUser:', error)
    throw new Error('Authentication required')
  }
}

// Get user details from users table
export const getUserDetails = async (supabaseClient: any, userId: string) => {
  console.log('Getting user details for:', userId)
  const { data: userData, error: userDataError } = await supabaseClient
    .from('users')
    .select('first_name, last_name, email, phone, avatar_url, username')
    .eq('id', userId)
    .single()

  if (userDataError) {
    console.error('Error fetching user data:', userDataError)
    throw new Error('Error fetching user data')
  }

  console.log('User details found:', userData)
  return userData
}

// Common response builder
export const buildResponse = (
  data: any,
  status = 200,
  success = true
): Response => {
  return new Response(
    JSON.stringify({ success, ...(success ? { data } : { error: data }) }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

// Error response builder
export const buildErrorResponse = (
  error: Error | string,
  status = 400
): Response => {
  const message = error instanceof Error ? error.message : error
  return buildResponse(message, status, false)
}

// Handle CORS preflight
export const handleCors = (req: Request): Response | null => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return null
}

interface CleanupData {
  clubId?: string
  userId?: string
  memberId?: string
  eventId?: number
}

export async function cleanupResources(
  supabaseClient: any,
  data: CleanupData
): Promise<void> {
  const { clubId, userId, memberId, eventId } = data

  try {
    // Clean up event if eventId is provided
    if (eventId) {
      const { error: eventError } = await supabaseClient
        .from('events')
        .delete()
        .eq('id', eventId)

      if (eventError) {
        console.error('Error cleaning up event:', eventError)
      }
    }

    // Clean up member if memberId is provided
    if (memberId) {
      const { error: memberError } = await supabaseClient
        .from('members')
        .delete()
        .eq('id', memberId)

      if (memberError) {
        console.error('Error cleaning up member:', memberError)
      }
    }

    // Clean up user if userId is provided
    if (userId) {
      const { error: userError } = await supabaseClient
        .from('users')
        .delete()
        .eq('id', userId)

      if (userError) {
        console.error('Error cleaning up user:', userError)
      }
    }

    // Clean up club if clubId is provided
    if (clubId) {
      const { error: clubError } = await supabaseClient
        .from('clubs')
        .delete()
        .eq('id', clubId)

      if (clubError) {
        console.error('Error cleaning up club:', clubError)
      }
    }
  } catch (error) {
    console.error('Error during cleanup:', error)
    throw error
  }
} 