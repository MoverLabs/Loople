import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { ApiResponse } from '../_shared/types.ts'
import {
  createSupabaseClient,
  validateEmail,
  handleCors,
  buildResponse,
  buildErrorResponse,
} from '../_shared/utils.ts'

interface ResendVerificationRequest {
  email: string
}

serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Create Supabase client
    const supabaseClient = createSupabaseClient(req)

    // Get request body
    const requestData: ResendVerificationRequest = await req.json()

    // Validate email
    if (!requestData.email) {
      throw new Error('Missing required field: email')
    }

    if (!validateEmail(requestData.email)) {
      throw new Error('Invalid email format')
    }

    // Resend verification email
    const { error } = await supabaseClient.auth.resend({
      type: 'signup',
      email: requestData.email,
    })

    if (error) {
      throw error
    }

    return buildResponse({ message: 'Verification email resent successfully' })
  } catch (error) {
    console.error('Error in resend verification:', error)
    return buildErrorResponse(
      error.message || 'Internal server error',
      error.status || 500
    )
  }
}) 