import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createSupabaseClient, getAuthUser, getUserDetails, buildResponse, buildErrorResponse } from "../_shared/utils.ts"
import { corsHeaders } from "../_shared/cors.ts"

interface PostRequest {
  club_id: number
  content_type: 'text' | 'event' | 'poll'
  content_text: string
  event_id?: number
  poll_question?: string
  poll_options?: string[]
}

interface PostQueryParams {
  club_id?: number
  user_id?: string
  content_type?: string
  page?: number
  limit?: number
  search?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  date_from?: string
  date_to?: string
  has_media?: boolean
}

interface CommentRequest {
  post_id: number
  content: string
  parent_comment_id?: number
}

interface ReactionRequest {
  post_id?: number
  comment_id?: number
  reaction_type: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry'
}

serve(async (req) => {
  console.log('=== Starting posts endpoint request ===')
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
    const pathSegments = urlObj.pathname.split('/')
    
    // For Supabase Edge Functions: /functions/v1/posts/1/reactions
    // We need to get everything after '/functions/v1/posts'
    const postsIndex = pathSegments.indexOf('posts')
    const path = postsIndex !== -1 ? pathSegments.slice(postsIndex + 1).join('/') : ''
    
    console.log('URL path segments:', pathSegments)
    console.log('Posts index:', postsIndex)
    console.log('Parsed path:', path)

    // Parse query parameters for GET requests
    const queryParams: PostQueryParams = {}
    if (method === 'GET') {
      urlObj.searchParams.forEach((value, key) => {
        if (key === 'page' || key === 'limit' || key === 'club_id') {
          queryParams[key] = parseInt(value)
        } else if (key === 'user_id') {
          queryParams[key] = value
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
      return buildErrorResponse('Error fetching user clubs', 500)
    }

    const userClubIds = userClubs.map(c => c.club_id)
    if (userClubIds.length === 0) {
      return buildErrorResponse('User is not a member of any club', 403)
    }

    switch (method) {
      case 'GET':
        // Handle different GET endpoints
        if (path === '') {
          return await handleGetPosts(supabaseClient, userClubIds, queryParams, user)
        } else if (path.includes('/comments')) {
          const postId = parseInt(path.split('/')[0])
          return await handleGetComments(supabaseClient, postId, userClubIds, queryParams)
        } else if (path.includes('/reactions')) {
          const postId = parseInt(path.split('/')[0])
          return await handleGetReactions(supabaseClient, postId, userClubIds)
        } else {
          return buildErrorResponse('Invalid endpoint', 404)
        }

      case 'POST':
        if (path === '') {
          return await handleCreatePost(supabaseClient, req, user.id, userClubIds, user, userData)
        } else if (path.includes('/comments')) {
          const postId = parseInt(path.split('/')[0])
          return await handleCreateComment(supabaseClient, req, user.id, postId, userClubIds)
        } else if (path.includes('/reactions')) {
          const postId = parseInt(path.split('/')[0])
          return await handleCreateReaction(supabaseClient, req, user.id, postId, userClubIds)
        } else {
          return buildErrorResponse('Invalid endpoint', 404)
        }

      case 'PUT':
        if (path.includes('/reactions')) {
          const postId = parseInt(path.split('/')[0])
          return await handleUpdateReaction(supabaseClient, req, user.id, postId, userClubIds)
        } else if (path !== '' && !path.includes('/')) {
          const postId = parseInt(path)
          return await handleUpdatePost(supabaseClient, req, user.id, postId, userClubIds)
        } else {
          return buildErrorResponse('Invalid endpoint', 404)
        }

      case 'DELETE':
        if (path !== '' && !path.includes('/')) {
          const postId = parseInt(path)
          return await handleDeletePost(supabaseClient, user.id, postId, userClubIds)
        } else if (path.includes('/comments/')) {
          const commentId = parseInt(path.split('/')[2])
          return await handleDeleteComment(supabaseClient, user.id, commentId, userClubIds)
        } else if (path.includes('/reactions')) {
          const postId = parseInt(path.split('/')[0])
          return await handleDeleteReaction(supabaseClient, user.id, postId, userClubIds)
        } else {
          return buildErrorResponse('Invalid endpoint', 404)
        }

      default:
        return buildErrorResponse('Method not allowed', 405)
    }
  } catch (error) {
    console.error('Error in posts endpoint:', error)
    return buildErrorResponse('Internal server error', 500)
  }
})

async function handleGetPosts(supabaseClient: any, userClubIds: number[], queryParams: PostQueryParams, user: any) {
  console.log('Fetching posts with params:', queryParams)
  
  let query = supabaseClient
    .from('posts')
    .select(`
      *,
      events (
        id,
        title,
        description,
        event_type,
        start_date,
        end_date,
        location
      )
    `)
    .in('club_id', userClubIds)
    .eq('is_active', true)

  // Apply filters
  if (queryParams.club_id) {
    query = query.eq('club_id', queryParams.club_id)
  }
  if (queryParams.user_id) {
    query = query.eq('user_id', queryParams.user_id)
  }
  if (queryParams.content_type) {
    query = query.eq('content_type', queryParams.content_type)
  }
  
  // Advanced search functionality
  if (queryParams.search) {
    const searchTerm = queryParams.search.trim()
    if (searchTerm.length > 0) {
      // Search in content_text, poll_question, and event titles
      query = query.or(`
        content_text.ilike.%${searchTerm}%,
        poll_question.ilike.%${searchTerm}%,
        events.title.ilike.%${searchTerm}%
      `)
    }
  }

  // Date range filtering
  if (queryParams.date_from) {
    query = query.gte('created_at', queryParams.date_from)
  }
  if (queryParams.date_to) {
    query = query.lte('created_at', queryParams.date_to)
  }

  // Has media attachments filter
  if (queryParams.has_media !== undefined) {
    if (queryParams.has_media) {
      query = query.not('id', 'in', `(SELECT post_id FROM media_attachments WHERE post_id IS NOT NULL)`)
    } else {
      query = query.not('id', 'in', `(SELECT post_id FROM media_attachments WHERE post_id IS NOT NULL)`)
    }
  }

  // Apply sorting
  if (queryParams.sort_by) {
    const order = queryParams.sort_order || 'desc'
    query = query.order(queryParams.sort_by, { ascending: order === 'asc' })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  // Apply pagination
  if (queryParams.page && queryParams.limit) {
    const offset = (queryParams.page - 1) * queryParams.limit
    query = query.range(offset, offset + queryParams.limit - 1)
  }

  const { data: posts, error } = await query

  if (error) {
    console.error('Error fetching posts:', error)
    return buildErrorResponse('Error fetching posts', 500)
  }

  // Get reaction counts for each post
  const postIds = posts.map((post: any) => post.id)
  const { data: reactions } = await supabaseClient
    .from('reactions')
    .select('post_id, reaction_type')
    .in('post_id', postIds)

  // Get comment counts for each post
  const { data: comments } = await supabaseClient
    .from('comments')
    .select('post_id')
    .in('post_id', postIds)
    .eq('is_active', true)

  // Get user data for all post authors
  const userIds = [...new Set(posts.map((post: any) => post.user_id))]
  const { data: postUsers } = await supabaseClient
    .from('users')
    .select('id, email, first_name, last_name')
    .in('id', userIds)

  // Create a map for quick user lookup
  const userMap = new Map()
  postUsers?.forEach((user: any) => {
    userMap.set(user.id, user)
  })

  // Process posts to include reaction and comment counts
  const processedPosts = posts.map((post: any) => {
    const postReactions = reactions?.filter(r => r.post_id === post.id) || []
    const postComments = comments?.filter(c => c.post_id === post.id) || []
    
    // Extract user vote for poll posts
    let userVote = null
    if (post.content_type === 'poll' && post.poll_votes) {
      try {
        const pollVotes = JSON.parse(post.poll_votes)
        const userVoteKey = `user_${user.id}`
        if (pollVotes[userVoteKey] !== undefined) {
          userVote = pollVotes[userVoteKey]
        }
      } catch (error) {
        console.warn('Failed to parse poll votes for post:', post.id, error)
        userVote = null
      }
    }
    
    return {
      ...post,
      users: userMap.get(post.user_id) || {
        id: post.user_id,
        email: '',
        first_name: 'Unknown',
        last_name: 'User'
      },
      reaction_count: postReactions.length,
      comment_count: postComments.length,
      reactions_by_type: postReactions.reduce((acc: any, r) => {
        acc[r.reaction_type] = (acc[r.reaction_type] || 0) + 1
        return acc
      }, {}),
      user_vote: userVote
    }
  })

  console.log('Successfully fetched posts:', processedPosts.length)
  return buildResponse(processedPosts)
}

async function handleCreatePost(supabaseClient: any, req: Request, userId: string, userClubIds: number[], user: any, userData: any) {
  const body: PostRequest = await req.json()
  console.log('Creating post with data:', body)

  // Validate required fields
  if (!body.club_id || !body.content_text) {
    return buildErrorResponse('club_id and content_text are required', 400)
  }

  // Check if user is member of the club
  if (!userClubIds.includes(body.club_id)) {
    return buildErrorResponse('User is not a member of this club', 403)
  }

  // Validate poll data if content_type is poll
  if (body.content_type === 'poll') {
    if (!body.poll_question || !body.poll_options || body.poll_options.length < 2) {
      return buildErrorResponse('poll_question and poll_options (min 2) are required for poll posts', 400)
    }
  }

  const { data: post, error } = await supabaseClient
    .from('posts')
    .insert({
      club_id: body.club_id,
      user_id: userId,
      content_type: body.content_type,
      content_text: body.content_text,
      event_id: body.event_id || null,
      poll_question: body.poll_question || null,
      poll_options: body.poll_options ? JSON.stringify(body.poll_options) : null,
      poll_votes: '{}'
    })
    .select(`
      *,
      events (
        id,
        title,
        description,
        event_type,
        start_date,
        end_date,
        location
      )
    `)
    .single()

  if (error) {
    console.error('Error creating post:', error)
    return buildErrorResponse('Error creating post', 500)
  }

  // Add user data to the response
  const postWithUser = {
    ...post,
    users: {
      id: user.id,
      email: user.email,
      first_name: userData.first_name,
      last_name: userData.last_name
    }
  }

  console.log('Successfully created post:', post.id)
  return buildResponse(postWithUser)
}

async function handleGetComments(supabaseClient: any, postId: number, userClubIds: number[], queryParams: PostQueryParams) {
  console.log('Fetching comments for post:', postId)

  // Verify user has access to this post
  const { data: post } = await supabaseClient
    .from('posts')
    .select('club_id')
    .eq('id', postId)
    .single()

  if (!post || !userClubIds.includes(post.club_id)) {
    return buildErrorResponse('Post not found or access denied', 404)
  }

  let query = supabaseClient
    .from('comments')
    .select(`
      *,
      users!comments_user_id_fkey (
        id,
        email,
        first_name,
        last_name
      )
    `)
    .eq('post_id', postId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  // Apply pagination
  if (queryParams.page && queryParams.limit) {
    const offset = (queryParams.page - 1) * queryParams.limit
    query = query.range(offset, offset + queryParams.limit - 1)
  }

  const { data: comments, error } = await query

  if (error) {
    console.error('Error fetching comments:', error)
    return buildErrorResponse('Error fetching comments', 500)
  }

  console.log('Successfully fetched comments:', comments.length)
  return buildResponse(comments)
}

async function handleCreateComment(supabaseClient: any, req: Request, userId: string, postId: number, userClubIds: number[]) {
  const body: CommentRequest = await req.json()
  console.log('Creating comment with data:', body)

  // Validate required fields
  if (!body.content || body.content.trim().length === 0) {
    return buildErrorResponse('Comment content is required', 400)
  }

  // Verify user has access to this post
  const { data: post } = await supabaseClient
    .from('posts')
    .select('club_id')
    .eq('id', postId)
    .single()

  if (!post || !userClubIds.includes(post.club_id)) {
    return buildErrorResponse('Post not found or access denied', 404)
  }

  // Get user data
  const { data: userData } = await supabaseClient
    .from('users')
    .select('id, email, first_name, last_name')
    .eq('id', userId)
    .single()

  const { data: comment, error } = await supabaseClient
    .from('comments')
    .insert({
      post_id: postId,
      user_id: userId,
      content: body.content.trim(),
      parent_comment_id: body.parent_comment_id || null
    })
    .select(`
      *,
      users!comments_user_id_fkey (
        id,
        email,
        first_name,
        last_name
      )
    `)
    .single()

  if (error) {
    console.error('Error creating comment:', error)
    return buildErrorResponse('Error creating comment', 500)
  }

  console.log('Successfully created comment:', comment.id)
  return buildResponse(comment)
}

async function handleGetReactions(supabaseClient: any, postId: number, userClubIds: number[]) {
  console.log('Fetching reactions for post:', postId)

  // Verify user has access to this post
  const { data: post } = await supabaseClient
    .from('posts')
    .select('club_id')
    .eq('id', postId)
    .single()

  if (!post || !userClubIds.includes(post.club_id)) {
    return buildErrorResponse('Post not found or access denied', 404)
  }

  const { data: reactions, error } = await supabaseClient
    .from('reactions')
    .select('reaction_type, user_id')
    .eq('post_id', postId)

  if (error) {
    console.error('Error fetching reactions:', error)
    return buildErrorResponse('Error fetching reactions', 500)
  }

  // Group reactions by type
  const reactionsByType = reactions.reduce((acc: any, r) => {
    acc[r.reaction_type] = (acc[r.reaction_type] || 0) + 1
    return acc
  }, {})

  console.log('Successfully fetched reactions:', reactions.length)
  return buildResponse({
    total: reactions.length,
    by_type: reactionsByType,
    user_reaction: reactions.find(r => r.user_id === postId)?.reaction_type || null
  })
}

async function handleCreateReaction(supabaseClient: any, req: Request, userId: string, postId: number, userClubIds: number[]) {
  const body: ReactionRequest = await req.json()
  console.log('Creating reaction with data:', body)

  // Verify user has access to this post
  const { data: post } = await supabaseClient
    .from('posts')
    .select('club_id')
    .eq('id', postId)
    .single()

  if (!post || !userClubIds.includes(post.club_id)) {
    return buildErrorResponse('Post not found or access denied', 404)
  }

  // Check if user already has a reaction on this post
  const { data: existingReaction } = await supabaseClient
    .from('reactions')
    .select('id, reaction_type')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .single()

  if (existingReaction) {
    // Update existing reaction
    const { data: reaction, error } = await supabaseClient
      .from('reactions')
      .update({ reaction_type: body.reaction_type })
      .eq('id', existingReaction.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating reaction:', error)
      return buildErrorResponse('Error updating reaction', 500)
    }

    console.log('Successfully updated reaction:', reaction.id)
    return buildResponse(reaction)
  } else {
    // Create new reaction
    const { data: reaction, error } = await supabaseClient
      .from('reactions')
      .insert({
        post_id: postId,
        user_id: userId,
        reaction_type: body.reaction_type
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating reaction:', error)
      return buildErrorResponse('Error creating reaction', 500)
    }

    console.log('Successfully created reaction:', reaction.id)
    return buildResponse(reaction)
  }
}

async function handleUpdateReaction(supabaseClient: any, req: Request, userId: string, postId: number, userClubIds: number[]) {
  const body: ReactionRequest = await req.json()
  console.log('Updating reaction with data:', body)

  // Verify user has access to this post
  const { data: post } = await supabaseClient
    .from('posts')
    .select('club_id')
    .eq('id', postId)
    .single()

  if (!post || !userClubIds.includes(post.club_id)) {
    return buildErrorResponse('Post not found or access denied', 404)
  }

  const { data: reaction, error } = await supabaseClient
    .from('reactions')
    .update({ reaction_type: body.reaction_type })
    .eq('post_id', postId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating reaction:', error)
    return buildErrorResponse('Error updating reaction', 500)
  }

  console.log('Successfully updated reaction:', reaction.id)
  return buildResponse(reaction)
}

async function handleUpdatePost(supabaseClient: any, req: Request, userId: string, postId: number, userClubIds: number[]) {
  const body: PostRequest = await req.json()
  console.log('Updating post with data:', body)

  // Verify user owns this post and has access
  const { data: existingPost } = await supabaseClient
    .from('posts')
    .select('club_id, user_id, content_type')
    .eq('id', postId)
    .single()

  if (!existingPost || existingPost.user_id !== userId || !userClubIds.includes(existingPost.club_id)) {
    return buildErrorResponse('Post not found or access denied', 404)
  }

  // Validate required fields
  if (!body.content_text || body.content_text.trim().length === 0) {
    return buildErrorResponse('Post content is required', 400)
  }

  // Validate poll data if content_type is poll
  if (body.content_type === 'poll') {
    if (!body.poll_question || !body.poll_options || body.poll_options.length < 2) {
      return buildErrorResponse('poll_question and poll_options (min 2) are required for poll posts', 400)
    }
  }

  // Prepare update data
  const updateData: any = {
    content_text: body.content_text.trim(),
    updated_at: new Date().toISOString()
  }

  // Update poll data if it's a poll post
  if (body.content_type === 'poll') {
    updateData.poll_question = body.poll_question
    updateData.poll_options = JSON.stringify(body.poll_options)
  }

  const { data: updatedPost, error } = await supabaseClient
    .from('posts')
    .update(updateData)
    .eq('id', postId)
    .select(`
      *,
      events (
        id,
        title,
        description,
        event_type,
        start_date,
        end_date,
        location
      )
    `)
    .single()

  if (error) {
    console.error('Error updating post:', error)
    return buildErrorResponse('Error updating post', 500)
  }

  // Get user data for response
  const { data: userData } = await supabaseClient
    .from('users')
    .select('id, email, first_name, last_name')
    .eq('id', userId)
    .single()

  const postWithUser = {
    ...updatedPost,
    users: {
      id: userData.id,
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name
    }
  }

  console.log('Successfully updated post:', postId)
  return buildResponse(postWithUser)
}

async function handleDeletePost(supabaseClient: any, userId: string, postId: number, userClubIds: number[]) {
  console.log('Deleting post:', postId)

  // Verify user owns this post and has access
  const { data: post } = await supabaseClient
    .from('posts')
    .select('club_id, user_id')
    .eq('id', postId)
    .single()

  if (!post || post.user_id !== userId || !userClubIds.includes(post.club_id)) {
    return buildErrorResponse('Post not found or access denied', 404)
  }

  const { error } = await supabaseClient
    .from('posts')
    .update({ is_active: false })
    .eq('id', postId)

  if (error) {
    console.error('Error deleting post:', error)
    return buildErrorResponse('Error deleting post', 500)
  }

  console.log('Successfully deleted post:', postId)
  return buildResponse({ success: true })
}

async function handleDeleteComment(supabaseClient: any, userId: string, commentId: number, userClubIds: number[]) {
  console.log('Deleting comment:', commentId)

  // Verify user owns this comment and has access
  const { data: comment } = await supabaseClient
    .from('comments')
    .select('user_id, post_id, posts!inner(club_id)')
    .eq('id', commentId)
    .single()

  if (!comment || comment.user_id !== userId || !userClubIds.includes(comment.posts.club_id)) {
    return buildErrorResponse('Comment not found or access denied', 404)
  }

  const { error } = await supabaseClient
    .from('comments')
    .update({ is_active: false })
    .eq('id', commentId)

  if (error) {
    console.error('Error deleting comment:', error)
    return buildErrorResponse('Error deleting comment', 500)
  }

  console.log('Successfully deleted comment:', commentId)
  return buildResponse({ success: true })
}

async function handleDeleteReaction(supabaseClient: any, userId: string, postId: number, userClubIds: number[]) {
  console.log('Deleting reaction for post:', postId)

  // Verify user has access to this post
  const { data: post } = await supabaseClient
    .from('posts')
    .select('club_id')
    .eq('id', postId)
    .single()

  if (!post || !userClubIds.includes(post.club_id)) {
    return buildErrorResponse('Post not found or access denied', 404)
  }

  const { error } = await supabaseClient
    .from('reactions')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting reaction:', error)
    return buildErrorResponse('Error deleting reaction', 500)
  }

  console.log('Successfully deleted reaction for post:', postId)
  return buildResponse({ success: true })
}
