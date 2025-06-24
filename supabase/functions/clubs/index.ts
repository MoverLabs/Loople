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
  // Handle CORS
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabaseClient = createSupabaseClient(req)
    const user = await getAuthUser(supabaseClient)
    const userData = await getUserDetails(supabaseClient, user.id)

    // Get the request method and path
    const { method, url } = req
    const path = new URL(url).pathname.split('/').pop()

    // Handle different HTTP methods
    switch (method) {
      case 'GET':
        if (!path || path === 'clubs') {
          // Get all clubs where user is a member
          const { data: clubs, error } = await supabaseClient
            .from('clubs')
            .select(`
              id, 
              name, 
              subdomain, 
              description, 
              contact_email,
              owner_id,
              members!inner (
                user_id
              )
            `)
            .eq('members.user_id', user.id)
          
          if (error) throw error
          
          return buildResponse(
            clubs.map(club => ({
              ...club,
              is_owner: club.owner_id === user.id
            }))
          )
        } else {
          // Get specific club by subdomain
          const { data: club, error } = await supabaseClient
            .from('clubs')
            .select(`
              id, 
              name, 
              subdomain, 
              description, 
              contact_email,
              owner_id,
              members!inner (
                user_id,
                first_name,
                last_name,
                email,
                member_type
              )
            `)
            .eq('subdomain', path)
            .eq('members.user_id', user.id)
            .single()
          
          if (error) throw error
          
          return buildResponse({
            ...club,
            is_owner: club.owner_id === user.id
          })
        }

      case 'POST':
        const requestData: CreateClubRequest = await req.json()

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

        const fieldError = validateRequiredFields(requestData, requiredFields)
        if (fieldError) {
          throw new Error(fieldError)
        }

        // Validate email and phone
        if (!validateEmail(requestData.contact_email)) {
          throw new Error('Invalid email format')
        }

        if (!validatePhone(requestData.contact_phone)) {
          throw new Error('Invalid phone format. Use format: (XXX) XXX-XXXX')
        }

        // Check if subdomain is already taken
        const { data: existingClub, error: subdomainError } = await supabaseClient
          .from('clubs')
          .select('id')
          .eq('subdomain', requestData.subdomain)
          .single()

        if (subdomainError && subdomainError.code !== 'PGRST116') {
          throw new Error('Error checking subdomain availability')
        }

        if (existingClub) {
          throw new Error('Subdomain already taken')
        }

        // Create the club with the authenticated user as owner
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

        if (createError) throw createError

        // Create member record for the club owner
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
          await cleanupResources(supabaseClient, { clubId: club.id })
          throw new Error('Failed to create member record')
        }

        // Update user role to admin
        const { error: userUpdateError } = await supabaseClient
          .from('users')
          .update({
            role_id: ParticipantRole.ADMIN,
            club_id: club.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)

        if (userUpdateError) {
          await cleanupResources(supabaseClient, { 
            clubId: club.id,
            memberId: `${club.id}_${user.id}` // Composite key format
          })
          throw new Error('Failed to update user role')
        }

        return buildResponse(
          {
            ...club,
            is_owner: true
          },
          201
        )

      case 'PUT':
        if (!path) {
          throw new Error('Club ID required')
        }

        // Verify user is the owner of the club
        const { data: clubToUpdate, error: clubError } = await supabaseClient
          .from('clubs')
          .select('owner_id')
          .eq('id', path)
          .single()

        if (clubError || !clubToUpdate) {
          throw new Error('Club not found')
        }

        if (clubToUpdate.owner_id !== user.id) {
          throw new Error('Only club owner can update club details')
        }

        const updateData = await req.json()

        // Update club
        const { data: updatedClub, error: updateError } = await supabaseClient
          .from('clubs')
          .update({
            ...updateData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', path)
          .select()
          .single()

        if (updateError) throw updateError

        return buildResponse({
          ...updatedClub,
          is_owner: true
        })

      default:
        throw new Error(`Method ${method} not allowed`)
    }
  } catch (error) {
    console.error(error)
    return buildErrorResponse(
      error,
      error.message.includes('Authentication required') ? 401 : 400
    )
  }
}) 