import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { ApiResponse, Member, MembershipStatus, MemberType } from '../_shared/types.ts'

interface JoinClubRequest {
    club_id: number
}

serve(async (req) => {
    console.log('Starting join club request')
    
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Create Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        console.log('Supabase Config:', { 
            url: supabaseUrl,
            hasAnonKey: !!supabaseAnonKey,
            authHeader: req.headers.get('Authorization')
        })

        const supabaseClient = createClient(
            supabaseUrl,
            supabaseAnonKey,
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

        console.log('Auth User:', { 
            userId: user?.id, 
            userEmail: user?.email,
            userError: userError?.message 
        })

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
            .select('id, name')
            .eq('id', clubId)
            .single()

        console.log('Club Query:', { 
            clubId: clubId, 
            clubFound: !!club, 
            clubName: club?.name,
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
        console.log('Checking existing membership for:', {
            clubId,
            userId: user.id
        })

        const { data: existingMember, error: memberError } = await supabaseClient
            .from('members')
            .select('id, membership_status, user_id, club_id')
            .eq('club_id', clubId)
            .eq('user_id', user.id)
            .single()

        console.log('Membership Check Result:', {
            existingMember,
            memberError,
            errorCode: memberError?.code,
            errorMessage: memberError?.message,
            errorDetails: memberError?.details
        })

        if (memberError && memberError.code !== 'PGRST116') {
            console.error('Membership check failed:', memberError)
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Error checking membership',
                    details: memberError.message
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
        console.log('Fetching user data for:', user.id)
        const { data: userData, error: userDataError } = await supabaseClient
            .from('users')
            .select('first_name, last_name, email, phone')
            .eq('id', user.id)
            .single()

        console.log('User Data Result:', {
            userData,
            userDataError
        })

        if (userDataError) {
            console.error('User data fetch failed:', userDataError)
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Error fetching user data',
                    details: userDataError.message
                } as ApiResponse<null>),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        // Create the member record
        console.log('Creating member record:', {
            clubId,
            userId: user.id,
            firstName: userData.first_name,
            lastName: userData.last_name
        })

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

        console.log('Member Creation Result:', {
            success: !!member,
            member,
            createError
        })

        if (createError) {
            console.error('Member creation failed:', createError)
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Error creating membership',
                    details: createError.message
                } as ApiResponse<null>),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        console.log('Successfully created membership')
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
        console.error('Unexpected error:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: 'Internal server error',
                details: error.message
            } as ApiResponse<null>),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    }
}) 