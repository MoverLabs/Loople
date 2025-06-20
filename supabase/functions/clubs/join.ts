import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { ApiResponse, Member, MembershipStatus, MemberType } from '../_shared/types.ts'

interface JoinClubRequest {
    club_id: number
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

        console.log('Auth User:', { userId: user?.id, userError })

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
        console.log('Request Data (before conversion):', requestData)
        
        // Convert club_id to number if it's a string
        const clubId = typeof requestData.club_id === 'string' ? parseInt(requestData.club_id, 10) : requestData.club_id
        console.log('Converted club_id:', clubId)

        // Validate required fields
        if (!clubId || isNaN(clubId)) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Invalid club_id: must be a valid number'
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
            .eq('id', clubId)
            .single()

        console.log('Club Query:', { 
            clubId: clubId, 
            clubFound: !!club, 
            club,
            clubError 
        })

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
            .eq('club_id', clubId)
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

        // Get user information from the users table
        const { data: userData, error: userDataError } = await supabaseClient
            .from('users')
            .select('first_name, last_name, email, phone')
            .eq('id', user.id)
            .single()

        if (userDataError) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Error fetching user data'
                } as ApiResponse<null>),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        // Create the member record
        const { data: member, error: createError } = await supabaseClient
            .from('members')
            .insert([
                {
                    club_id: clubId,
                    user_id: user.id,
                    first_name: userData.first_name,
                    last_name: userData.last_name,
                    email: userData.email,
                    phone: userData.phone,
                    member_type: MemberType.ADULT,
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