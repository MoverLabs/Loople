import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { ApiResponse, Member, MembershipStatus, MemberType } from '../_shared/types.ts'

interface BulkInviteRequest {
  club_id: number
  members: {
    email: string
    first_name: string
    last_name: string
    member_type: MemberType
  }[]
}

interface BulkInviteResponse {
  successful: Member[]
  failed: {
    email: string
    error: string
  }[]
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
    const requestData: BulkInviteRequest = await req.json()

    // Validate request
    if (!requestData.club_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing club_id'
        } as ApiResponse<null>),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!Array.isArray(requestData.members) || requestData.members.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Members array is required and must not be empty'
        } as ApiResponse<null>),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if club exists and if user has admin rights
    const { data: club, error: clubError } = await supabaseClient
      .from('clubs')
      .select(`
        id,
        name,
        users!inner (
          id,
          role_id,
          roles!inner (
            name
          )
        )
      `)
      .eq('id', requestData.club_id)
      .eq('users.id', user.id)
      .single()

    if (clubError || !club) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Club not found or you do not have access'
        } as ApiResponse<null>),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if user has admin role
    const userRole = club.users[0].roles.name
    if (userRole !== 'admin') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Only club admins can send invites'
        } as ApiResponse<null>),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const successful: Member[] = []
    const failed: { email: string; error: string }[] = []

    // Process each member
    for (const memberData of requestData.members) {
      try {
        // Validate member data
        if (!memberData.email || !memberData.first_name || !memberData.last_name || !memberData.member_type) {
          failed.push({
            email: memberData.email || 'unknown',
            error: 'Missing required fields'
          })
          continue
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(memberData.email)) {
          failed.push({
            email: memberData.email,
            error: 'Invalid email format'
          })
          continue
        }

        // Check if email is already a member
        const { data: existingMember, error: memberError } = await supabaseClient
          .from('members')
          .select('id, membership_status')
          .eq('club_id', requestData.club_id)
          .eq('email', memberData.email)
          .single()

        if (memberError && memberError.code !== 'PGRST116') {
          failed.push({
            email: memberData.email,
            error: 'Error checking membership'
          })
          continue
        }

        if (existingMember) {
          failed.push({
            email: memberData.email,
            error: `Already a ${existingMember.membership_status} member`
          })
          continue
        }

        // Create the member record
        const { data: member, error: createError } = await supabaseClient
          .from('members')
          .insert([
            {
              club_id: requestData.club_id,
              first_name: memberData.first_name,
              last_name: memberData.last_name,
              email: memberData.email,
              member_type: memberData.member_type,
              membership_status: MembershipStatus.PENDING,
              membership_start_date: new Date().toISOString(),
            },
          ])
          .select()
          .single()

        if (createError) {
          failed.push({
            email: memberData.email,
            error: 'Error creating membership'
          })
          continue
        }

        // Generate invite token
        const inviteToken = crypto.randomUUID()
        
        // Store invite token
        const { error: inviteError } = await supabaseClient
          .from('invites')
          .insert([
            {
              token: inviteToken,
              member_id: member.id,
              club_id: requestData.club_id,
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
              created_by: user.id
            }
          ])

        if (inviteError) {
          failed.push({
            email: memberData.email,
            error: 'Error generating invite'
          })
          continue
        }

        // Queue invite email
        const inviteUrl = `${Deno.env.get('FRONTEND_URL')}/join/${inviteToken}`
        const { error: emailError } = await supabaseClient
          .from('emails')
          .insert([
            {
              to: memberData.email,
              template: 'club-invite',
              data: {
                club_name: club.name,
                first_name: memberData.first_name,
                invite_url: inviteUrl
              }
            }
          ])

        if (emailError) {
          console.error(`Failed to queue invite email for ${memberData.email}:`, emailError)
          // Don't fail the member creation, just log the error
        }

        successful.push(member)
      } catch (error) {
        failed.push({
          email: memberData.email,
          error: 'Internal error processing member'
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          successful,
          failed
        }
      } as ApiResponse<BulkInviteResponse>),
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