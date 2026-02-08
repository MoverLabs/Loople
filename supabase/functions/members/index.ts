import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  createSupabaseClient,
  getAuthUser,
  buildResponse,
  buildErrorResponse,
} from '../_shared/utils.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  console.log('=== Starting members endpoint request ===')
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
    // Verify auth header
    const authHeader = req.headers.get('Authorization')
    console.log('Auth header present:', !!authHeader)
    if (!authHeader) {
      console.error('No Authorization header found')
      return buildErrorResponse('Authentication required', 401)
    }

    // Initialize Supabase client and get authenticated user
    console.log('Creating Supabase client...')
    const supabaseClient = createSupabaseClient(req)
    console.log('Supabase client created successfully')

    console.log('Getting authenticated user...')
    const user = await getAuthUser(supabaseClient)
    console.log('Authenticated user:', { id: user.id, email: user.email })

    // Get query parameters
    const url = new URL(req.url)
    const clubId = url.searchParams.get('clubId')

    // Base query to select club and member details
    const selectQuery = `
      id,
      name,
      subdomain,
      description,
      contact_email,
      contact_phone,
      address,
      city,
      state,
      zip_code,
      created_at,
      updated_at,
      members (
        id,
        user_id,
        first_name,
        last_name,
        email,
        phone,
        member_type,
        created_at,
        updated_at
      )
    `

    let query = supabaseClient
      .from('clubs')
      .select(selectQuery)

    if (clubId) {
      // If clubId is provided, verify user has access to this club
      console.log('Verifying club access for club:', clubId)
      const { data: membership, error: membershipError } = await supabaseClient
        .from('members')
        .select('user_id')
        .eq('club_id', clubId)
        .eq('user_id', user.id)
        .single()

      if (membershipError || !membership) {
        console.error('User does not have access to this club')
        return buildErrorResponse('You do not have access to this club', 403)
      }

      // Get specific club and its members
      query = query.eq('id', clubId).single()
      console.log('Fetching specific club and members for club:', clubId)
    } else {
      // Get all clubs owned by the user
      query = query.eq('owner_id', user.id).order('name', { ascending: true })
      console.log('Fetching all clubs and members for user:', user.id)
    }

    const { data: result, error: queryError } = await query

    if (queryError) {
      console.error('Error fetching clubs and members:', queryError)
      throw queryError
    }

    // Process the results
    if (clubId) {
      // Single club case
      if (!result) {
        return buildErrorResponse('Club not found', 404)
      }
      result.members = result.members.sort((a, b) => a.last_name.localeCompare(b.last_name))
      console.log('Successfully fetched club and its members')
      return buildResponse(result)
    } else {
      // Multiple clubs case
      const clubsWithSortedMembers = result.map(club => ({
        ...club,
        members: club.members.sort((a, b) => a.last_name.localeCompare(b.last_name))
      }))
      console.log(`Successfully fetched ${result.length} clubs with their members`)
      return buildResponse(clubsWithSortedMembers)
    }

  } catch (error) {
    console.error('Error in members endpoint:', error)
    const isAuthError = error.message.includes('Authentication required') ||
                       error.message.includes('JWT expired') ||
                       error.message.includes('invalid token') ||
                       error.message.includes('Invalid JWT')
    
    return buildErrorResponse(error.message, isAuthError ? 401 : 400)
  }
})