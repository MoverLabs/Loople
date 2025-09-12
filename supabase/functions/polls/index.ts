import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createSupabaseClient, getAuthUser, getUserDetails, buildResponse, buildErrorResponse } from "../_shared/utils.ts"
import { corsHeaders } from "../_shared/cors.ts"

interface PollVoteRequest {
  post_id: number
  option_index: number
}

serve(async (req) => {
  console.log('=== Starting polls endpoint request ===')
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
    const path = urlObj.pathname.split('/').pop()

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
        // Get poll results
        const postId = parseInt(urlObj.searchParams.get('post_id') || '0')
        if (!postId) {
          return buildErrorResponse('post_id parameter is required', 400)
        }
        return await handleGetPollResults(supabaseClient, postId, userClubIds)

      case 'POST':
        // Vote on a poll
        const body: PollVoteRequest = await req.json()
        return await handleVoteOnPoll(supabaseClient, body, user.id, userClubIds)

      default:
        return buildErrorResponse('Method not allowed', 405)
    }
  } catch (error) {
    console.error('Error in polls endpoint:', error)
    return buildErrorResponse('Internal server error', 500)
  }
})

async function handleGetPollResults(supabaseClient: any, postId: number, userClubIds: number[]) {
  console.log('Fetching poll results for post:', postId)

  // Verify user has access to this post
  const { data: post, error: postError } = await supabaseClient
    .from('posts')
    .select('club_id, poll_question, poll_options, poll_votes')
    .eq('id', postId)
    .eq('content_type', 'poll')
    .single()

  if (postError || !post) {
    console.error('Error fetching post:', postError)
    return buildErrorResponse('Poll not found', 404)
  }

  if (!userClubIds.includes(post.club_id)) {
    return buildErrorResponse('Access denied', 403)
  }

  // Parse poll options and votes
  const pollOptions = JSON.parse(post.poll_options || '[]')
  const pollVotes = JSON.parse(post.poll_votes || '{}')

  // Calculate vote counts for each option
  const voteCounts = pollOptions.map((option: string, index: number) => ({
    option,
    index,
    votes: pollVotes[index] || 0
  }))

  const totalVotes = Object.values(pollVotes).reduce((sum: number, count: any) => sum + count, 0)

  console.log('Successfully fetched poll results')
  return buildResponse({
    question: post.poll_question,
    options: voteCounts,
    total_votes: totalVotes,
    user_vote: null // We'll implement user-specific vote tracking if needed
  })
}

async function handleVoteOnPoll(supabaseClient: any, body: PollVoteRequest, userId: string, userClubIds: number[]) {
  console.log('Voting on poll with data:', body)

  // Validate required fields
  if (!body.post_id || body.option_index === undefined) {
    return buildErrorResponse('post_id and option_index are required', 400)
  }

  // Verify user has access to this post
  const { data: post, error: postError } = await supabaseClient
    .from('posts')
    .select('club_id, poll_options, poll_votes')
    .eq('id', body.post_id)
    .eq('content_type', 'poll')
    .single()

  if (postError || !post) {
    console.error('Error fetching post:', postError)
    return buildErrorResponse('Poll not found', 404)
  }

  if (!userClubIds.includes(post.club_id)) {
    return buildErrorResponse('Access denied', 403)
  }

  // Parse poll options and votes
  const pollOptions = JSON.parse(post.poll_options || '[]')
  const pollVotes = JSON.parse(post.poll_votes || '{}')

  // Validate option index
  if (body.option_index < 0 || body.option_index >= pollOptions.length) {
    return buildErrorResponse('Invalid option index', 400)
  }

  // Check if user has already voted (we'll use a simple approach for now)
  // In a more sophisticated system, you might want a separate poll_votes table
  const userVoteKey = `user_${userId}`
  if (pollVotes[userVoteKey] !== undefined) {
    return buildErrorResponse('User has already voted on this poll', 400)
  }

  // Update the vote count for the selected option
  const newVoteCount = (pollVotes[body.option_index] || 0) + 1
  pollVotes[body.option_index] = newVoteCount
  pollVotes[userVoteKey] = body.option_index // Track user's vote

  // Update the post with new vote data
  const { data: updatedPost, error: updateError } = await supabaseClient
    .from('posts')
    .update({ poll_votes: JSON.stringify(pollVotes) })
    .eq('id', body.post_id)
    .select('poll_votes')
    .single()

  if (updateError) {
    console.error('Error updating poll votes:', updateError)
    return buildErrorResponse('Error updating poll votes', 500)
  }

  console.log('Successfully voted on poll')
  return buildResponse({
    success: true,
    option_index: body.option_index,
    new_vote_count: newVoteCount,
    total_votes: Object.values(JSON.parse(updatedPost.poll_votes)).reduce((sum: number, count: any) => {
      if (typeof count === 'number') return sum + count
      return sum
    }, 0)
  })
}
