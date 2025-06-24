import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
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
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    }
  )
}

// Get authenticated user with error handling
export const getAuthUser = async (supabaseClient: any) => {
  const { data: { user }, error } = await supabaseClient.auth.getUser()
  if (error || !user) {
    throw new Error('Authentication required')
  }
  return user
}

// Get user details from users table
export const getUserDetails = async (supabaseClient: any, userId: string) => {
  const { data: userData, error: userDataError } = await supabaseClient
    .from('users')
    .select('first_name, last_name, email, phone')
    .eq('id', userId)
    .single()

  if (userDataError) {
    throw new Error('Error fetching user data')
  }

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

// Cleanup resources in case of error
export const cleanupResources = async (
  supabaseClient: any,
  {
    clubId,
    userId,
    memberId,
  }: {
    clubId?: string
    userId?: string
    memberId?: string
  }
) => {
  try {
    if (memberId) {
      await supabaseClient
        .from('members')
        .delete()
        .eq('id', memberId)
    }

    if (clubId) {
      await supabaseClient
        .from('clubs')
        .delete()
        .eq('id', clubId)
    }

    // Only cleanup user data if specifically requested
    if (userId) {
      await supabaseClient
        .from('users')
        .delete()
        .eq('id', userId)
    }
  } catch (error) {
    console.error('Error during cleanup:', error)
  }
} 