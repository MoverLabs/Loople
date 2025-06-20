import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { ApiResponse } from '../_shared/types.ts'

interface ResendVerificationRequest {
    email: string
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
            Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        )

        // Get request body
        const requestData: ResendVerificationRequest = await req.json()

        // Validate required fields
        if (!requestData.email) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Missing required field: email'
                } as ApiResponse<null>),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        // Resend verification email
        const { error } = await supabaseClient.auth.resend({
            type: 'signup',
            email: requestData.email,
        })

        if (error) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: error.message
                } as ApiResponse<null>),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        return new Response(
            JSON.stringify({
                success: true,
                data: { message: 'Verification email resent successfully' }
            } as ApiResponse<{ message: string }>),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
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