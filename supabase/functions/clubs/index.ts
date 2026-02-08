import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { MemberType, ParticipantRole } from '../_shared/types.ts'
import {
  createSupabaseClient,
  getAuthUser,
  getUserDetails,
  validateEmail,
  validatePhone,
  validateRequiredFields,
  handleCors,
  buildResponse,
  buildErrorResponse,
  cleanupResources,
} from '../_shared/utils.ts'
import { corsHeaders } from '../_shared/cors.ts'

// Club creation request type based on requirements
interface CreateClubRequest {
  name: string
  subdomain: string
  description: string
  contact_email: string
  contact_phone: string
  address: string
  city: string
  state: string
  zip_code: string
}

serve(async (req) => {
  console.log('=== Starting clubs endpoint request ===')
  console.log('Request details:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  })

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Log the auth header for debugging
    const authHeader = req.headers.get('Authorization')
    console.log('Auth header present:', !!authHeader)
    if (!authHeader) {
      console.error('No Authorization header found')
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Creating Supabase client...')
    const supabaseClient = createSupabaseClient(req)
    console.log('Supabase client created successfully')

    console.log('Getting authenticated user...')
    const user = await getAuthUser(supabaseClient)
    console.log('Authenticated user:', { id: user.id, email: user.email })

    console.log('Getting user details...')
    const userData = await getUserDetails(supabaseClient, user.id)
    console.log('User details retrieved:', userData)

    // Get the request method and path
    const { method, url } = req
    const path = new URL(url).pathname.split('/').pop()
    console.log('Request path details:', { method, path })

    // Handle different HTTP methods
    switch (method) {
      case 'GET':
        if (!path || path === 'clubs') {
          console.log('Fetching all clubs for user:', user.id)
          // Get all clubs where user is a member (check both user_id and email)
          // First get the club IDs where user is a member
          const { data: memberClubs, error: memberError } = await supabaseClient
            .from('members')
            .select('club_id')
            .or(`user_id.eq."${user.id}",email.eq."${user.email}"`)
          
          if (memberError) {
            console.error('Error fetching member clubs:', memberError)
            throw memberError
          }
          
          if (!memberClubs || memberClubs.length === 0) {
            console.log('No clubs found for user')
            return buildResponse([])
          }
          
          const clubIds = memberClubs.map(m => m.club_id)
          
          // Now get the clubs
          const { data: clubs, error } = await supabaseClient
            .from('clubs')
            .select(`
              id, 
              name, 
              subdomain, 
              description, 
              contact_email,
              owner_id
            `)
            .in('id', clubIds)
          
          if (error) {
            console.error('Error fetching clubs:', error)
            throw error
          }
          
          console.log('Successfully fetched clubs:', clubs)
          return buildResponse(
            clubs.map(club => ({
              ...club,
              is_owner: club.owner_id === user.id
            }))
          )
        } else {
          console.log('Fetching specific club by subdomain:', path)
          // Get specific club by subdomain (check both user_id and email)
          // First get the club by subdomain
          const { data: club, error: clubError } = await supabaseClient
            .from('clubs')
            .select(`
              id, 
              name, 
              subdomain, 
              description, 
              contact_email,
              owner_id
            `)
            .eq('subdomain', path)
            .single()
          
          if (clubError) {
            console.error('Error fetching club:', clubError)
            throw clubError
          }
          
          // Check if user is a member of this club
          const { data: membership, error: memberError } = await supabaseClient
            .from('members')
            .select('user_id, first_name, last_name, email, member_type')
            .eq('club_id', club.id)
            .or(`user_id.eq."${user.id}",email.eq."${user.email}"`)
            .single()
          
          if (memberError) {
            console.error('User is not a member of this club:', memberError)
            throw new Error('Access denied: You are not a member of this club')
          }
          
          // Add membership info to club data
          const clubWithMembers = {
            ...club,
            members: [membership]
          }
          
          console.log('Successfully fetched club:', clubWithMembers)
          return buildResponse({
            ...clubWithMembers,
            is_owner: club.owner_id === user.id
          })
        }

      case 'POST':
        console.log('Processing club creation request')
        const requestData: CreateClubRequest = await req.json()
        console.log('Request data:', requestData)

        // Validate required fields
        const requiredFields = [
          'name',
          'subdomain',
          'description',
          'contact_email',
          'contact_phone',
          'address',
          'city',
          'state',
          'zip_code',
        ] as const

        console.log('Validating required fields...')
        const fieldError = validateRequiredFields(requestData, requiredFields)
        if (fieldError) {
          console.error('Field validation error:', fieldError)
          throw new Error(fieldError)
        }

        // Validate email and phone
        console.log('Validating email and phone...')
        if (!validateEmail(requestData.contact_email)) {
          throw new Error('Invalid email format')
        }

        if (!validatePhone(requestData.contact_phone)) {
          throw new Error('Invalid phone format. Use format: (XXX) XXX-XXXX')
        }

        // Check if subdomain is already taken
        console.log('Checking subdomain availability:', requestData.subdomain)
        const { data: existingClub, error: subdomainError } = await supabaseClient
          .from('clubs')
          .select('id')
          .eq('subdomain', requestData.subdomain)
          .single()

        if (subdomainError && subdomainError.code !== 'PGRST116') {
          console.error('Error checking subdomain:', subdomainError)
          throw new Error('Error checking subdomain availability')
        }

        if (existingClub) {
          console.error('Subdomain already taken:', requestData.subdomain)
          throw new Error('Subdomain already taken')
        }

        // Create the club with the authenticated user as owner
        console.log('Creating new club...')
        let clubId: string | undefined
        try {
          const { data: club, error: createError } = await supabaseClient
            .from('clubs')
            .insert([
              {
                ...requestData,
                owner_id: user.id,
                onboarding_completed: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ])
            .select()
            .single()

          if (createError) {
            console.error('Error creating club:', createError)
            throw createError
          }

          clubId = club.id
          console.log('Club created successfully:', club)

          // Create member record for the club owner
          console.log('Creating member record for owner...')
          const { error: memberError } = await supabaseClient
            .from('members')
            .insert({
              club_id: club.id,
              user_id: user.id,
              first_name: userData.first_name,
              last_name: userData.last_name,
              email: userData.email,
              phone: userData.phone,
              member_type: MemberType.ADULT,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })

          if (memberError) {
            console.error('Error creating member record:', memberError)
            throw memberError
          }

          // Update user role to admin
          console.log('Updating user role to admin...')
          const { error: userUpdateError } = await supabaseClient
            .from('users')
            .update({
              role_id: ParticipantRole.ADMIN,
              club_id: club.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id)

          if (userUpdateError) {
            console.error('Error updating user role:', userUpdateError)
            throw userUpdateError
          }

          console.log('Club creation completed successfully')
          return buildResponse(
            {
              ...club,
              is_owner: true
            },
            201
          )
        } catch (error) {
          console.error('Error during club creation process:', error)
          // Cleanup any created resources
          if (clubId) {
            await cleanupResources(supabaseClient, {
              clubId,
              memberId: `${clubId}_${user.id}` // Composite key format
            })
          }
          throw error
        }

      case 'PUT':
        if (!path) {
          throw new Error('Club ID required')
        }

        console.log('Processing club update request for ID:', path)
        let originalClubData: any

        try {
          // Verify user is the owner of the club and get original data
          const { data: clubToUpdate, error: clubError } = await supabaseClient
            .from('clubs')
            .select('*')
            .eq('id', path)
            .single()

          if (clubError || !clubToUpdate) {
            console.error('Error fetching club to update:', clubError)
            throw new Error('Club not found')
          }

          if (clubToUpdate.owner_id !== user.id) {
            console.error('Unauthorized update attempt:', {
              userId: user.id,
              ownerId: clubToUpdate.owner_id
            })
            throw new Error('Only club owner can update club details')
          }

          originalClubData = clubToUpdate
          const updateData = await req.json()
          console.log('Update data:', updateData)

          // Update club
          console.log('Updating club...')
          const { data: updatedClub, error: updateError } = await supabaseClient
            .from('clubs')
            .update({
              ...updateData,
              updated_at: new Date().toISOString(),
            })
            .eq('id', path)
            .select()
            .single()

          if (updateError) {
            console.error('Error updating club:', updateError)
            throw updateError
          }

          console.log('Club updated successfully:', updatedClub)
          return buildResponse({
            ...updatedClub,
            is_owner: true
          })
        } catch (error) {
          console.error('Error during club update:', error)
          // If we have original data and the update failed, try to restore original state
          if (originalClubData) {
            try {
              await supabaseClient
                .from('clubs')
                .update(originalClubData)
                .eq('id', path)
            } catch (restoreError) {
              console.error('Failed to restore original club data:', restoreError)
            }
          }
          throw error
        }

      default:
        console.error('Invalid method:', method)
        throw new Error(`Method ${method} not allowed`)
    }
  } catch (error) {
    console.error('Error in clubs endpoint:', error)
    const isAuthError = error.message.includes('Authentication required') ||
                       error.message.includes('JWT expired') ||
                       error.message.includes('invalid token') ||
                       error.message.includes('Invalid JWT')
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.stack
      }),
      {
        status: isAuthError ? 401 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}) 