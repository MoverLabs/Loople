import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { ApiResponse, Member, MembershipStatus, MemberType, ParticipantRole } from '../_shared/types.ts'

interface InviteRequest {
  club_id: number
  email: string
  first_name: string
  last_name: string
  member_type: MemberType
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key for admin operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
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
      console.error('Auth error:', userError)
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' } as ApiResponse<null>),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Authenticated user:', { userId: user.id, email: user.email })

    // Get request body
    const requestData: InviteRequest = await req.json()
    console.log('Invite request data:', requestData)

    // Validate required fields
    const requiredFields = ['club_id', 'email', 'first_name', 'last_name', 'member_type'] as const
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

    // Check if club exists and if user has admin rights
    console.log('Checking club access for:', { clubId: requestData.club_id, userId: user.id })
    
    // First check if club exists and user is owner
    const { data: club, error: clubError } = await supabaseClient
      .from('clubs')
      .select('id, name, owner_id')
      .eq('id', requestData.club_id)
      .single()

    if (clubError) {
      console.error('Club fetch error:', clubError)
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

    console.log('Club data found:', club)

    // Check if user is owner or active member
    if (club.owner_id !== user.id) {
      const { data: membership, error: membershipError } = await supabaseClient
        .from('members')
        .select('id, membership_status')
        .eq('club_id', club.id)
        .eq('user_id', user.id)
        .eq('membership_status', 'active')
        .single()

      console.log('Membership check:', { membership, membershipError })

      if (membershipError || !membership) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'You do not have access to this club'
          } as ApiResponse<null>),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
    }

    // If we get here, user has access
    console.log('Access granted:', { isOwner: club.owner_id === user.id })

    // Check if email is already a member
    const { data: existingMember, error: memberError } = await supabaseClient
      .from('members')
      .select('id, membership_status')
      .eq('club_id', requestData.club_id)
      .eq('email', requestData.email)
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
          error: `This email is already a ${existingMember.membership_status} member of this club`
        } as ApiResponse<null>),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if user exists in auth system
    const { data: existingAuthUser, error: authUserError } = await supabaseClient
      .from('users')
      .select('id')
      .eq('email', requestData.email)
      .single()

    let invitedUserId = existingAuthUser?.id

    // If user doesn't exist, create a new user with magic link
    if (!existingAuthUser) {
      console.log('Creating new user:', { email: requestData.email })
      
      try {
        // Create new user in auth system without a password
        const { data: newAuthUser, error: createUserError } = await supabaseClient.auth.admin.createUser({
          email: requestData.email,
          email_confirm: true, // Set to true since we'll send invite email
          user_metadata: {
            first_name: requestData.first_name,
            last_name: requestData.last_name,
            full_name: `${requestData.first_name} ${requestData.last_name}`,
            role: ParticipantRole.MEMBER
          },
          password: crypto.randomUUID() // Temporary password that will be changed via magic link
        })

        if (createUserError) {
          console.error('Create user error:', createUserError)
          return new Response(
            JSON.stringify({
              success: false,
              error: `Failed to create user account: ${createUserError.message}`
            } as ApiResponse<null>),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }

        console.log('New user created:', { userId: newAuthUser.user.id })
        invitedUserId = newAuthUser.user.id

        // Insert into users table
        const { error: userInsertError } = await supabaseClient
          .from('users')
          .insert([
            {
              id: invitedUserId,
              email: requestData.email,
              first_name: requestData.first_name,
              last_name: requestData.last_name,
              role: ParticipantRole.MEMBER
            }
          ])

        if (userInsertError) {
          console.error('User insert error:', userInsertError)
          // Delete the auth user if we couldn't create the user record
          await supabaseClient.auth.admin.deleteUser(invitedUserId)
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Failed to create user record'
            } as ApiResponse<null>),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
      } catch (error) {
        console.error('Unexpected error during user creation:', error)
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Unexpected error during user creation'
          } as ApiResponse<null>),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
    }

    // Generate invite token
    const inviteToken = crypto.randomUUID()
    
    // Create the member record with pending status
    const { data: member, error: createError } = await supabaseClient
      .from('members')
      .insert([
        {
          club_id: requestData.club_id,
          first_name: requestData.first_name,
          last_name: requestData.last_name,
          email: requestData.email,
          member_type: requestData.member_type,
          membership_status: MembershipStatus.PENDING,
          membership_start_date: new Date().toISOString(),
          user_id: invitedUserId
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
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Error generating invite'
        } as ApiResponse<null>),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Send magic link email for new users or invite email for existing users
    const inviteUrl = `${Deno.env.get('FRONTEND_URL')}/join/${inviteToken}`
    const { error: emailError } = !existingAuthUser 
      ? await supabaseClient.auth.admin.generateLink({
          type: 'magiclink',
          email: requestData.email,
          options: {
            redirectTo: inviteUrl,
            data: {
              club_name: club.name,
              first_name: requestData.first_name,
              invite_token: inviteToken
            }
          }
        })
      : await supabaseClient.auth.admin.inviteUserByEmail(requestData.email, {
          redirectTo: inviteUrl,
          data: {
            club_name: club.name,
            first_name: requestData.first_name,
            invite_token: inviteToken
          }
        })

    if (emailError) {
      console.error('Failed to send invite email:', emailError)
      // Don't fail the request, just log the error
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