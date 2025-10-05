import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  createSupabaseClient,
  getAuthUser,
  getUserDetails,
  validateEmail,
  validateRequiredFields,
  handleCors,
  buildResponse,
  buildErrorResponse,
} from '../_shared/utils.ts'
import { corsHeaders } from '../_shared/cors.ts'

// User profile update request type
interface UpdateUserProfileRequest {
  first_name?: string
  last_name?: string
  phone?: string
  avatar_url?: string
}

// User preferences request type
interface UpdateUserPreferencesRequest {
  notify_comments?: boolean
  notify_candidates?: boolean
  notify_offers?: boolean
  push_notifications?: 'everything' | 'same_as_email' | 'none'
}

serve(async (req) => {
  console.log('=== Starting users endpoint request ===')
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
        if (!path || path === 'users') {
          console.log('Fetching user profile for:', user.id)
          // Get user profile with preferences
          const { data: userProfile, error: userError } = await supabaseClient
            .from('users')
            .select(`
              id,
              email,
              first_name,
              last_name,
              phone,
              avatar_url,
              created_at,
              updated_at,
              role:roles(name, permissions)
            `)
            .eq('id', user.id)
            .single()
          
          if (userError) {
            console.error('Error fetching user profile:', userError)
            throw userError
          }

          // Get user preferences
          const { data: preferences, error: prefError } = await supabaseClient
            .from('user_preferences')
            .select('*')
            .eq('user_id', user.id)
            .single()

          if (prefError && prefError.code !== 'PGRST116') {
            console.error('Error fetching user preferences:', prefError)
            throw prefError
          }

          console.log('Successfully fetched user profile:', userProfile)
          return buildResponse({
            ...userProfile,
            preferences: preferences || {
              notify_comments: true,
              notify_candidates: false,
              notify_offers: false,
              push_notifications: 'everything'
            }
          })
        } else {
          throw new Error('Invalid GET request')
        }

      case 'PUT':
        console.log('Processing user profile update request')
        const requestData: UpdateUserProfileRequest = await req.json()
        console.log('Request data:', requestData)

        // Validate fields if provided
        if (requestData.first_name !== undefined && !requestData.first_name.trim()) {
          throw new Error('First name cannot be empty')
        }
        if (requestData.last_name !== undefined && !requestData.last_name.trim()) {
          throw new Error('Last name cannot be empty')
        }
        if (requestData.phone !== undefined && requestData.phone && !/^\(\d{3}\) \d{3}-\d{4}$/.test(requestData.phone)) {
          throw new Error('Invalid phone format. Use format: (XXX) XXX-XXXX')
        }
        if (requestData.avatar_url !== undefined && requestData.avatar_url && !/^https?:\/\/.+/.test(requestData.avatar_url)) {
          throw new Error('Please enter a valid URL for avatar')
        }

        // Update user profile
        console.log('Updating user profile...')
        const { data: updatedUser, error: updateError } = await supabaseClient
          .from('users')
          .update({
            ...requestData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
          .select(`
            id,
            email,
            first_name,
            last_name,
            phone,
            avatar_url,
            created_at,
            updated_at,
            role:roles(name, permissions)
          `)
          .single()

        if (updateError) {
          console.error('Error updating user profile:', updateError)
          throw updateError
        }

        console.log('User profile updated successfully:', updatedUser)
        return buildResponse(updatedUser)

      case 'PATCH':
        console.log('Processing user preferences update request')
        const preferencesData: UpdateUserPreferencesRequest = await req.json()
        console.log('Preferences data:', preferencesData)

        // Validate preferences
        if (preferencesData.push_notifications && !['everything', 'same_as_email', 'none'].includes(preferencesData.push_notifications)) {
          throw new Error('Invalid push notification preference')
        }

        // Upsert user preferences
        console.log('Updating user preferences...')
        const { data: updatedPreferences, error: prefUpdateError } = await supabaseClient
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            ...preferencesData,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (prefUpdateError) {
          console.error('Error updating user preferences:', prefUpdateError)
          throw prefUpdateError
        }

        console.log('User preferences updated successfully:', updatedPreferences)
        return buildResponse(updatedPreferences)

      default:
        console.error('Invalid method:', method)
        throw new Error(`Method ${method} not allowed`)
    }
  } catch (error) {
    console.error('Error in users endpoint:', error)
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
