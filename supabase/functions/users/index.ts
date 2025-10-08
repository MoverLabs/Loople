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
  username?: string
  bio?: string
  cover_url?: string
  country?: string
  street_address?: string
  city?: string
  region?: string
  postal_code?: string
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
              username,
              bio,
              cover_url,
              country,
              street_address,
              city,
              region,
              postal_code,
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

        // Build updates object with gentle validation and UX-friendly behavior
        const fieldErrors: Record<string, string> = {}
        const updates: Record<string, unknown> = {}

        // first_name: ignore if empty string; only update when non-empty provided
        if (requestData.first_name !== undefined) {
          const v = (requestData.first_name || '').trim()
          if (v.length > 0) {
            updates.first_name = v
          }
        }

        // last_name: ignore if empty string; only update when non-empty provided
        if (requestData.last_name !== undefined) {
          const v = (requestData.last_name || '').trim()
          if (v.length > 0) {
            updates.last_name = v
          }
        }

        // phone: allow null when empty; validate when provided non-empty
        if (requestData.phone !== undefined) {
          const v = (requestData.phone || '').trim()
          if (v.length === 0) {
            updates.phone = null
          } else if (!/^\(\d{3}\) \d{3}-\d{4}$/.test(v)) {
            fieldErrors.phone = 'Invalid phone format. Use (XXX) XXX-XXXX'
          } else {
            updates.phone = v
          }
        }

        // avatar_url: allow null when empty; validate URL when provided non-empty
        if (requestData.avatar_url !== undefined) {
          const v = (requestData.avatar_url || '').trim()
          if (v.length === 0) {
            updates.avatar_url = null
          } else if (!/^https?:\/\/.+/.test(v)) {
            fieldErrors.avatar_url = 'Please enter a valid URL for avatar'
          } else {
            updates.avatar_url = v
          }
        }

        // username: trim, lower uniqueness is enforced by index; allow null when empty
        if (requestData.username !== undefined) {
          const v = (requestData.username || '').trim()
          if (v.length === 0) {
            updates.username = null
          } else if (!/^[A-Za-z0-9_\.\-]{3,30}$/.test(v)) {
            fieldErrors.username = 'Username must be 3-30 chars: letters, numbers, underscore, dot, hyphen'
          } else {
            updates.username = v
          }
        }

        // bio: allow null when empty; limit length gently
        if (requestData.bio !== undefined) {
          const v = (requestData.bio || '').trim()
          if (v.length === 0) {
            updates.bio = null
          } else if (v.length > 300) {
            fieldErrors.bio = 'Bio must be 300 characters or fewer'
          } else {
            updates.bio = v
          }
        }

        // cover_url: allow null when empty; validate URL when provided
        if (requestData.cover_url !== undefined) {
          const v = (requestData.cover_url || '').trim()
          if (v.length === 0) {
            updates.cover_url = null
          } else if (!/^https?:\/\/.+/.test(v)) {
            fieldErrors.cover_url = 'Please enter a valid URL for cover image'
          } else {
            updates.cover_url = v
          }
        }

        // Address fields: trim, allow null when empty
        const optTrim = (s?: string) => (s || '').trim()
        if (requestData.country !== undefined) {
          const v = optTrim(requestData.country)
          updates.country = v.length === 0 ? null : v
        }
        if (requestData.street_address !== undefined) {
          const v = optTrim(requestData.street_address)
          updates.street_address = v.length === 0 ? null : v
        }
        if (requestData.city !== undefined) {
          const v = optTrim(requestData.city)
          updates.city = v.length === 0 ? null : v
        }
        if (requestData.region !== undefined) {
          const v = optTrim(requestData.region)
          updates.region = v.length === 0 ? null : v
        }
        if (requestData.postal_code !== undefined) {
          const v = optTrim(requestData.postal_code)
          updates.postal_code = v.length === 0 ? null : v
        }

        if (Object.keys(fieldErrors).length > 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'Validation error', field_errors: fieldErrors }),
            { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Only perform update if there is at least one field to update
        if (Object.keys(updates).length === 0) {
          console.log('No profile fields to update; returning current profile')
          const { data: currentUser, error: getErr } = await supabaseClient
            .from('users')
            .select(`
              id,
              email,
              first_name,
              last_name,
              phone,
              avatar_url,
              username,
              bio,
              cover_url,
              country,
              street_address,
              city,
              region,
              postal_code,
              created_at,
              updated_at,
              role:roles(name, permissions)
            `)
            .eq('id', user.id)
            .single()
          if (getErr) {
            console.error('Error fetching current user:', getErr)
            throw getErr
          }
          return buildResponse(currentUser)
        }

        // Update user profile
        console.log('Updating user profile with:', updates)
        const { data: updatedUser, error: updateError } = await supabaseClient
          .from('users')
          .update({
            ...updates,
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
            username,
            bio,
            cover_url,
            country,
            street_address,
            city,
            region,
            postal_code,
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
          }, { onConflict: 'user_id' })
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
    const isAuthError = (error as Error).message.includes('Authentication required') ||
                       error.message.includes('JWT expired') ||
                       error.message.includes('invalid token') ||
                       error.message.includes('Invalid JWT')
    
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
        details: (error as Error).stack
      }),
      {
        status: isAuthError ? 401 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
