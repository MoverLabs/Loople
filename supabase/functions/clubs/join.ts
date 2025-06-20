import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { ApiResponse, Member, MembershipStatus, MemberType } from '../_shared/types.ts'

interface JoinClubRequest {
    club_id: number
    first_name: string
    last_name: string
    email: string
    phone?: string
    member_type: MemberType
    emergency_contact_name?: string
    emergency_contact_phone?: string
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
                JSON.stringify({ success: false, error: 'Unauthorized' } as ApiResponse<null>),
                {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        // Get request body
        const requestData: JoinClubRequest = await req.json()

        // Validate required fields
        const requiredFields = ['club_id', 'first_name', 'last_name', 'email', 'member_type'] as const
        for (const field of requiredFields) {
            if (!requestData[field]) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: `Missing required field: ${field}`
                    } as ApiResponse<null>),
                    {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    }
                )
            }
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(requestData.email)) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Invalid email format'
                } as ApiResponse<null>),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        // Check if club exists
        const { data: club, error: clubError } = await supabaseClient
            .from('clubs')
            .select('id')
            .eq('id', requestData.club_id)
            .single()

        if (clubError || !club) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Club not found'
                } as ApiResponse<null>),
                {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        // Check if user is already a member of this club
        const { data: existingMember, error: memberError } = await supabaseClient
            .from('members')
            .select('id, membership_status')
            .eq('club_id', requestData.club_id)
            .eq('user_id', user.id)
            .single()

        if (memberError && memberError.code !== 'PGRST116') {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Error checking membership'
                } as ApiResponse<null>),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        if (existingMember) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: `You are already a ${existingMember.membership_status} member of this club`
                } as ApiResponse<null>),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        // Create the member record
        const { data: member, error: createError } = await supabaseClient
            .from('members')
            .insert([
                {
                    club_id: requestData.club_id,
                    user_id: user.id,
                    first_name: requestData.first_name,
                    last_name: requestData.last_name,
                    email: requestData.email,
                    phone: requestData.phone,
                    member_type: requestData.member_type,
                    emergency_contact_name: requestData.emergency_contact_name,
                    emergency_contact_phone: requestData.emergency_contact_phone,
                    membership_status: MembershipStatus.PENDING,
                    membership_start_date: new Date().toISOString(),
                },
            ])
            .select()
            .single()

        if (createError) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Error creating membership'
                } as ApiResponse<null>),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        return new Response(
            JSON.stringify({
                success: true,
                data: member
            } as ApiResponse<Member>),
            {
                status: 201,
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