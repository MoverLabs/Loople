import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { ApiResponse, Member, MembershipStatus } from '../_shared/types.ts'

interface ConfirmInviteRequest {
  token: string
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
    const requestData: ConfirmInviteRequest = await req.json()

    // Validate token
    if (!requestData.token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing invite token'
        } as ApiResponse<null>),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get invite details
    const { data: invite, error: inviteError } = await supabaseClient
      .from('invites')
      .select(`
        token,
        member_id,
        club_id,
        expires_at,
        members!inner (
          id,
          email,
          membership_status
        )
      `)
      .eq('token', requestData.token)
      .single()

    if (inviteError || !invite) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid or expired invite token'
        } as ApiResponse<null>),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if invite is expired
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invite has expired'
        } as ApiResponse<null>),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if member email matches the authenticated user's email
    if (invite.members.email !== user.email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email mismatch. Please use the same email the invite was sent to.'
        } as ApiResponse<null>),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if member is already active
    if (invite.members.membership_status === MembershipStatus.ACTIVE) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Membership is already active'
        } as ApiResponse<null>),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Start a transaction to update member status and create user-club association
    const { data: member, error: updateError } = await supabaseClient
      .rpc('confirm_club_invite', {
        p_member_id: invite.member_id,
        p_club_id: invite.club_id,
        p_user_id: user.id
      })

    if (updateError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to confirm membership'
        } as ApiResponse<null>),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Delete the used invite
    const { error: deleteError } = await supabaseClient
      .from('invites')
      .delete()
      .eq('token', requestData.token)

    if (deleteError) {
      console.error('Failed to delete used invite:', deleteError)
      // Don't fail the request, just log the error
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: member
      } as ApiResponse<Member>),
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