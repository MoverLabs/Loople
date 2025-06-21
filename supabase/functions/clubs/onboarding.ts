import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { ApiResponse, Member, MembershipStatus } from '../_shared/types.ts'

interface OnboardingRequest {
  invite_token: string
  first_name: string
  last_name: string
  phone?: string
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
    const requestData: OnboardingRequest = await req.json()

    // Validate required fields
    const requiredFields = ['invite_token', 'first_name', 'last_name'] as const
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

    // Get invite details
    const { data: invite, error: inviteError } = await supabaseClient
      .from('invites')
      .select(`
        id,
        member_id,
        club_id,
        expires_at,
        members!inner (
          id,
          email,
          membership_status
        )
      `)
      .eq('token', requestData.invite_token)
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

    // Update member record
    const { data: member, error: updateError } = await supabaseClient
      .from('members')
      .update({
        user_id: user.id,
        first_name: requestData.first_name,
        last_name: requestData.last_name,
        phone: requestData.phone,
        emergency_contact_name: requestData.emergency_contact_name,
        emergency_contact_phone: requestData.emergency_contact_phone,
        membership_status: MembershipStatus.ACTIVE,
      })
      .eq('id', invite.member_id)
      .select()
      .single()

    if (updateError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Error updating membership'
        } as ApiResponse<null>),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Delete used invite
    const { error: deleteError } = await supabaseClient
      .from('invites')
      .delete()
      .eq('id', invite.id)

    if (deleteError) {
      console.error('Failed to delete used invite:', deleteError)
      // Don't fail the request, just log the error
    }

    // Send welcome email
    const { error: emailError } = await supabaseClient
      .from('emails')
      .insert([
        {
          to: invite.members.email,
          template: 'club-welcome',
          data: {
            first_name: requestData.first_name
          }
        }
      ])

    if (emailError) {
      console.error('Failed to queue welcome email:', emailError)
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