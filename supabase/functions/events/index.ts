import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { EventType } from '../_shared/types.ts'
import {
  createSupabaseClient,
  getAuthUser,
  getUserDetails,
  validateRequiredFields,
  handleCors,
  buildResponse,
  buildErrorResponse,
  cleanupResources,
} from '../_shared/utils.ts'
import { corsHeaders } from '../_shared/cors.ts'

// Event creation/update request type
interface EventRequest {
  club_id: number
  title: string
  description?: string
  event_type: EventType
  start_date: string
  end_date: string
  location?: string
  max_capacity?: number
  registration_deadline?: string
  price_member?: number
  price_non_member?: number
  program_id?: number
}

// Query parameters interface
interface EventQueryParams {
  club_id?: number
  program_id?: number
  event_type?: EventType
  start_date?: string
  end_date?: string
  is_active?: boolean
  search?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  page?: number
  limit?: number
}

// Add this interface after the existing interfaces
interface EventCleanupData {
  eventId?: number
  originalData?: Partial<EventRequest>
}

serve(async (req) => {
  console.log('=== Starting events endpoint request ===')
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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No Authorization header found')
      return buildErrorResponse('Authentication required', 401)
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

    // Get the request method and URL parameters
    const { method, url } = req
    const urlObj = new URL(url)
    const pathSegments = urlObj.pathname.split('/').filter(segment => segment !== '')
    const path = pathSegments[pathSegments.length - 1] // Get the last segment
    
    // For Supabase Edge Functions, the path structure is: /functions/v1/events/3/rsvp
    // So we need to find the 'events' segment and work from there
    const eventsIndex = pathSegments.indexOf('events')
    const isSingleEventRequest = eventsIndex >= 0 && pathSegments.length > eventsIndex + 1
    const isRSVPRequest = eventsIndex >= 0 && pathSegments.length > eventsIndex + 2 && path === 'rsvp'
    
    console.log('Request details:', {
      pathname: urlObj.pathname,
      pathSegments,
      path,
      eventsIndex,
      isSingleEventRequest,
      isRSVPRequest,
      method
    })

    // Parse query parameters for GET requests
    const queryParams: EventQueryParams = {}
    if (method === 'GET') {
      urlObj.searchParams.forEach((value, key) => {
        if (key === 'page' || key === 'limit') {
          queryParams[key] = parseInt(value)
        } else if (key === 'is_active') {
          queryParams[key] = value === 'true'
        } else {
          queryParams[key] = value
        }
      })
    }

    // First, get the user's club memberships
    const { data: userClubs, error: clubError } = await supabaseClient
      .from('members')
      .select('club_id')
      .eq('user_id', user.id)

    if (clubError) {
      console.error('Error fetching user clubs:', clubError)
      throw clubError
    }

    const userClubIds = userClubs.map(c => c.club_id)
    if (userClubIds.length === 0) {
      return buildErrorResponse('User is not a member of any club', 403)
    }

    switch (method) {
      case 'GET':
        // Check if this is a request for a specific event by ID
        if (isSingleEventRequest && !isRSVPRequest) {
          // This is a request for a specific event
          const eventIdString = pathSegments[eventsIndex + 1]
          const eventId = parseInt(eventIdString)
          if (isNaN(eventId)) {
            return buildErrorResponse(`Invalid event ID: ${eventIdString}`, 400)
          }

          // Get the specific event
          const { data: event, error: eventError } = await supabaseClient
            .from('events')
            .select(`
              *,
              clubs (
                name,
                subdomain
              ),
              programs (
                name,
                program_type
              ),
              event_registrations (
                id,
                status,
                registration_date
              )
            `)
            .eq('id', eventId)
            .single()

          if (eventError) {
            console.error('Error fetching event:', eventError)
            if (eventError.code === 'PGRST116') {
              return buildErrorResponse('Event not found', 404)
            }
            throw eventError
          }

          // Verify user has access to this event's club
          if (!userClubIds.includes(event.club_id)) {
            return buildErrorResponse('User is not a member of the event\'s club', 403)
          }

          return buildResponse(event)
        }

        // Check if this is an RSVP/registration request for a specific event
        if (isRSVPRequest) {
          const eventIdString = pathSegments[eventsIndex + 1]
          const eventId = parseInt(eventIdString)
          
          console.log('RSVP Request details:', {
            pathSegments,
            eventsIndex,
            eventIdString,
            eventId,
            isNaN: isNaN(eventId)
          })
          
          if (isNaN(eventId)) {
            return buildErrorResponse(`Invalid event ID: ${eventIdString}`, 400)
          }

          // Verify user has access to this event's club
          const { data: event, error: eventError } = await supabaseClient
            .from('events')
            .select('club_id')
            .eq('id', eventId)
            .single()

          if (eventError || !event) {
            return buildErrorResponse('Event not found', 404)
          }

          if (!userClubIds.includes(event.club_id)) {
            return buildErrorResponse('User is not a member of the event\'s club', 403)
          }

          // Get user's member record for this club
          const { data: member, error: memberError } = await supabaseClient
            .from('members')
            .select('id')
            .eq('user_id', user.id)
            .eq('club_id', event.club_id)
            .single()

          if (memberError || !member) {
            return buildErrorResponse('User is not a member of this club', 403)
          }

          // Handle RSVP operations based on request method
          if (method === 'GET') {
            // Get RSVPs for the event
            const { data: rsvps, error: rsvpError } = await supabaseClient
              .from('event_registrations')
              .select(`
                *,
                members (
                  id,
                  first_name,
                  last_name,
                  email,
                  user_id
                )
              `)
              .eq('event_id', eventId)

            if (rsvpError) {
              console.error('Error fetching RSVPs:', rsvpError)
              throw rsvpError
            }

            return buildResponse(rsvps || [])
          }

          if (method === 'POST' || method === 'PUT') {
            // Update or create RSVP
            const requestBody = await req.json().catch(() => ({}))
            const { status } = requestBody

            if (!status) {
              return buildErrorResponse('Status is required', 400)
            }

            // Validate status
            const validStatuses = ['registered', 'confirmed', 'canceled', 'waitlisted', 'attended']
            if (!validStatuses.includes(status)) {
              return buildErrorResponse(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400)
            }

            // Upsert RSVP
            const { data: rsvp, error: upsertError } = await supabaseClient
              .from('event_registrations')
              .upsert({
                event_id: eventId,
                member_id: member.id,
                status: status,
                registration_date: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'event_id,member_id'
              })
              .select(`
                *,
                members (
                  id,
                  first_name,
                  last_name,
                  email,
                  user_id
                )
              `)
              .single()

            if (upsertError) {
              console.error('Error upserting RSVP:', upsertError)
              throw upsertError
            }

            return buildResponse(rsvp)
          }

          return buildErrorResponse(`Method ${method} not allowed for RSVP`, 405)
        }

        // This is a request for listing events
        let query = supabaseClient
          .from('events')
          .select(`
            *,
            clubs (
              name,
              subdomain
            ),
            programs (
              name,
              program_type
            ),
            event_registrations (
              id,
              status,
              registration_date
            )
          `)
          .in('club_id', userClubIds)

        // Apply filters based on query parameters
        if (queryParams.club_id) {
          // Verify the requested club_id is one the user belongs to
          const requestedClubId = parseInt(String(queryParams.club_id))
          if (!userClubIds.includes(requestedClubId)) {
            return buildErrorResponse('User is not a member of the requested club', 403)
          }
          query = query.eq('club_id', requestedClubId)
        }
        if (queryParams.program_id) {
          query = query.eq('program_id', queryParams.program_id)
        }
        if (queryParams.event_type) {
          query = query.eq('event_type', queryParams.event_type)
        }
        if (queryParams.is_active !== undefined) {
          query = query.eq('is_active', queryParams.is_active)
        }
        if (queryParams.start_date) {
          query = query.gte('start_date', queryParams.start_date)
        }
        if (queryParams.end_date) {
          query = query.lte('end_date', queryParams.end_date)
        }
        if (queryParams.search) {
          query = query.ilike('title', `%${queryParams.search}%`)
        }

        // Apply sorting
        if (queryParams.sort_by) {
          const order = queryParams.sort_order || 'desc'
          query = query.order(queryParams.sort_by, { ascending: order === 'asc' })
        } else {
          // Default sort by start_date desc
          query = query.order('start_date', { ascending: false })
        }

        // Apply pagination
        if (queryParams.page && queryParams.limit) {
          const offset = (queryParams.page - 1) * queryParams.limit
          query = query.range(offset, offset + queryParams.limit - 1)
        }

        const { data: events, error: getError } = await query

        if (getError) {
          console.error('Error fetching events:', getError)
          throw getError
        }

        return buildResponse(events)

      case 'POST':
        const createData: EventRequest = await req.json()
        console.log('Create event request data:', createData)
        let createdEventId: number | undefined

        try {
          // Validate required fields
          const requiredFields = [
            'title',
            'event_type',
            'start_date',
            'end_date',
            'club_id'
          ] as const

          const fieldError = validateRequiredFields(createData, requiredFields)
          if (fieldError) {
            throw new Error(fieldError)
          }

          // Verify user is club owner
          const { data: club, error: ownerCheckError } = await supabaseClient
            .from('clubs')
            .select('owner_id')
            .eq('id', createData.club_id)
            .single()

          if (ownerCheckError || !club) {
            throw new Error('Club not found')
          }

          if (club.owner_id !== user.id) {
            return buildErrorResponse('Only club owner can create events', 403)
          }

          // Create event
          const { data: newEvent, error: createError } = await supabaseClient
            .from('events')
            .insert({
              ...createData,
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single()

          if (createError) {
            console.error('Error creating event:', createError)
            throw createError
          }

          createdEventId = newEvent.id
          console.log('Event created successfully:', newEvent)

          return buildResponse(newEvent, 201)
        } catch (error) {
          console.error('Error during event creation:', error)
          
          // Cleanup if event was partially created
          if (createdEventId) {
            console.log('Cleaning up partially created event:', createdEventId)
            try {
              await cleanupResources(supabaseClient, { eventId: createdEventId })
            } catch (cleanupError) {
              console.error('Error during cleanup:', cleanupError)
            }
          }
          
          throw error
        }

      case 'PUT':
        if (!path) {
          throw new Error('Event ID required')
        }

        const updateData: Partial<EventRequest> = await req.json()
        console.log('Update event request data:', updateData)
        let originalEventData: any

        try {
          // Verify event exists and user is club owner
          const { data: eventToUpdate, error: eventError } = await supabaseClient
            .from('events')
            .select('*, clubs!inner(owner_id)')
            .eq('id', path)
            .single()

          if (eventError || !eventToUpdate) {
            throw new Error('Event not found')
          }

          if (eventToUpdate.clubs.owner_id !== user.id) {
            return buildErrorResponse('Only club owner can update events', 403)
          }

          // Store original data for rollback if needed
          originalEventData = { ...eventToUpdate }

          // Update event
          const { data: updatedEvent, error: updateError } = await supabaseClient
            .from('events')
            .update({
              ...updateData,
              updated_at: new Date().toISOString()
            })
            .eq('id', path)
            .select()
            .single()

          if (updateError) {
            console.error('Error updating event:', updateError)
            throw updateError
          }

          return buildResponse(updatedEvent)
        } catch (error) {
          console.error('Error during event update:', error)

          // Attempt to rollback changes if we have original data
          if (originalEventData) {
            console.log('Rolling back event update:', path)
            try {
              const { error: rollbackError } = await supabaseClient
                .from('events')
                .update({
                  ...originalEventData,
                  updated_at: new Date().toISOString()
                })
                .eq('id', path)

              if (rollbackError) {
                console.error('Error during rollback:', rollbackError)
              }
            } catch (rollbackError) {
              console.error('Error during rollback:', rollbackError)
            }
          }

          throw error
        }

      case 'DELETE':
        if (!path) {
          throw new Error('Event ID required')
        }

        let deletedEventData: any

        try {
          // Verify event exists and user is club owner
          const { data: eventToDelete, error: deleteCheckError } = await supabaseClient
            .from('events')
            .select('*, clubs!inner(owner_id)')
            .eq('id', path)
            .single()

          if (deleteCheckError || !eventToDelete) {
            throw new Error('Event not found')
          }

          if (eventToDelete.clubs.owner_id !== user.id) {
            return buildErrorResponse('Only club owner can delete events', 403)
          }

          // Store event data for potential recovery
          deletedEventData = { ...eventToDelete }

          // Delete event
          const { error: deleteError } = await supabaseClient
            .from('events')
            .delete()
            .eq('id', path)

          if (deleteError) {
            console.error('Error deleting event:', deleteError)
            throw deleteError
          }

          return buildResponse({ message: 'Event deleted successfully' })
        } catch (error) {
          console.error('Error during event deletion:', error)

          // Attempt to recover deleted event if we have the data
          if (deletedEventData) {
            console.log('Attempting to recover deleted event:', path)
            try {
              const { error: recoveryError } = await supabaseClient
                .from('events')
                .insert({
                  ...deletedEventData,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })

              if (recoveryError) {
                console.error('Error during event recovery:', recoveryError)
              }
            } catch (recoveryError) {
              console.error('Error during event recovery:', recoveryError)
            }
          }

          throw error
        }

      default:
        return buildErrorResponse(`Method ${method} not allowed`, 405)
    }
  } catch (error) {
    console.error('Error in events endpoint:', error)
    const isAuthError = error.message.includes('Authentication required') ||
                       error.message.includes('JWT expired') ||
                       error.message.includes('invalid token') ||
                       error.message.includes('Invalid JWT')
    
    return buildErrorResponse(error.message, isAuthError ? 401 : 400)
  }
}) 