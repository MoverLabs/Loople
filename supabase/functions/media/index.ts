import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MediaAttachmentRequest {
  post_id: number
  file_name: string
  file_path: string
  file_size: number
  mime_type: string
  file_type: string
}

function buildResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function buildErrorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return buildErrorResponse('Unauthorized', 401)
    }

    // Get user's club memberships
    const { data: memberships } = await supabaseClient
      .from('members')
      .select('club_id')
      .eq('user_id', user.id)
      .eq('status', 'confirmed')

    const userClubIds = memberships?.map(m => m.club_id) || []
    if (userClubIds.length === 0) {
      return buildErrorResponse('User is not a member of any club', 403)
    }

    const url = new URL(req.url)
    const path = url.pathname.replace('/media', '')
    const method = req.method

    switch (method) {
      case 'GET':
        if (path.includes('?')) {
          const postId = parseInt(url.searchParams.get('post_id') || '0')
          return await handleGetMediaAttachments(supabaseClient, postId, userClubIds)
        } else {
          return buildErrorResponse('Invalid endpoint', 404)
        }

      case 'POST':
        if (path === '') {
          return await handleCreateMediaAttachment(supabaseClient, req, user.id, userClubIds)
        } else {
          return buildErrorResponse('Invalid endpoint', 404)
        }

      case 'DELETE':
        if (path !== '' && !path.includes('/')) {
          const attachmentId = parseInt(path)
          return await handleDeleteMediaAttachment(supabaseClient, user.id, attachmentId, userClubIds)
        } else {
          return buildErrorResponse('Invalid endpoint', 404)
        }

      default:
        return buildErrorResponse('Method not allowed', 405)
    }
  } catch (error) {
    console.error('Media endpoint error:', error)
    return buildErrorResponse('Internal server error', 500)
  }
})

async function handleGetMediaAttachments(supabaseClient: any, postId: number, userClubIds: number[]) {
  console.log('Fetching media attachments for post:', postId)

  // Verify user has access to this post
  const { data: post } = await supabaseClient
    .from('posts')
    .select('club_id')
    .eq('id', postId)
    .single()

  if (!post || !userClubIds.includes(post.club_id)) {
    return buildErrorResponse('Post not found or access denied', 404)
  }

  const { data: attachments, error } = await supabaseClient
    .from('media_attachments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching media attachments:', error)
    return buildErrorResponse('Error fetching media attachments', 500)
  }

  console.log('Successfully fetched media attachments:', attachments.length)
  return buildResponse(attachments)
}

async function handleCreateMediaAttachment(supabaseClient: any, req: Request, userId: string, userClubIds: number[]) {
  const body: MediaAttachmentRequest = await req.json()
  console.log('Creating media attachment with data:', body)

  // Validate required fields
  if (!body.post_id || !body.file_name || !body.file_path) {
    return buildErrorResponse('post_id, file_name, and file_path are required', 400)
  }

  // Verify user has access to this post
  const { data: post } = await supabaseClient
    .from('posts')
    .select('club_id, user_id')
    .eq('id', body.post_id)
    .single()

  if (!post || post.user_id !== userId || !userClubIds.includes(post.club_id)) {
    return buildErrorResponse('Post not found or access denied', 404)
  }

  const { data: attachment, error } = await supabaseClient
    .from('media_attachments')
    .insert({
      post_id: body.post_id,
      file_name: body.file_name,
      file_path: body.file_path,
      file_size: body.file_size,
      mime_type: body.mime_type,
      file_type: body.file_type
    })
    .select('*')
    .single()

  if (error) {
    console.error('Error creating media attachment:', error)
    return buildErrorResponse('Error creating media attachment', 500)
  }

  console.log('Successfully created media attachment:', attachment.id)
  return buildResponse(attachment)
}

async function handleDeleteMediaAttachment(supabaseClient: any, userId: string, attachmentId: number, userClubIds: number[]) {
  console.log('Deleting media attachment:', attachmentId)

  // Verify user has access to this attachment
  const { data: attachment } = await supabaseClient
    .from('media_attachments')
    .select('post_id, posts!inner(club_id, user_id)')
    .eq('id', attachmentId)
    .single()

  if (!attachment || attachment.posts.user_id !== userId || !userClubIds.includes(attachment.posts.club_id)) {
    return buildErrorResponse('Media attachment not found or access denied', 404)
  }

  // Delete from storage first
  const { error: storageError } = await supabaseClient.storage
    .from('post-media')
    .remove([attachment.file_path])

  if (storageError) {
    console.error('Error deleting file from storage:', storageError)
    // Continue with database deletion even if storage deletion fails
  }

  // Delete from database
  const { error } = await supabaseClient
    .from('media_attachments')
    .delete()
    .eq('id', attachmentId)

  if (error) {
    console.error('Error deleting media attachment:', error)
    return buildErrorResponse('Error deleting media attachment', 500)
  }

  console.log('Successfully deleted media attachment:', attachmentId)
  return buildResponse({ success: true })
}
