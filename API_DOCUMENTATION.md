# Loople API Documentation

## Overview

The Loople API is a multi-tenant swim club management platform built on Supabase. It provides endpoints for club management, member management, events, and authentication.

**Base URL**: `https://your-project.supabase.co/functions/v1`

## Authentication

All API endpoints require authentication via JWT tokens from Supabase Auth. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Common Response Format

All endpoints return responses in this format:

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
```

## Error Handling

- **401 Unauthorized**: Invalid or missing authentication token
- **403 Forbidden**: User doesn't have permission for the action
- **404 Not Found**: Resource not found
- **400 Bad Request**: Invalid request data
- **500 Internal Server Error**: Server error

---

## Authentication Endpoints

### Sign Up

**POST** `/signup`

Creates a new user account and optionally creates a new club.

#### Request Body

```typescript
interface SignupRequest {
  email: string
  password: string
  data: {
    first_name: string
    last_name: string
    phone?: string
    club_name?: string        // Required if creating a club
    club_subdomain?: string   // Required if creating a club
    birth_date?: string       // ISO date string
  }
}
```

#### Response

```typescript
interface SignupResponse {
  success: boolean
  data?: {
    user: {
      id: string
      email: string
      name: string
    }
    club?: Club
  }
  error?: string
}
```

#### Example

```bash
curl -X POST https://your-project.supabase.co/functions/v1/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securepassword123",
    "data": {
      "first_name": "John",
      "last_name": "Doe",
      "phone": "(555) 123-4567",
      "club_name": "Aqua Masters",
      "club_subdomain": "aqua-masters",
      "birth_date": "1990-01-15"
    }
  }'
```

---

## Club Management Endpoints

### Get User's Clubs

**GET** `/clubs`

Retrieves all clubs where the authenticated user is a member.

#### Response

```typescript
interface Club {
  id: number
  name: string
  subdomain: string
  description?: string
  contact_email?: string
  owner_id: string
  is_owner: boolean
  members: {
    user_id: string
    first_name: string
    last_name: string
    email: string
    member_type: 'adult' | 'child' | 'family'
  }[]
}
```

#### Example

```bash
curl -X GET https://your-project.supabase.co/functions/v1/clubs \
  -H "Authorization: Bearer <token>"
```

### Get Specific Club

**GET** `/clubs/{subdomain}`

Retrieves details for a specific club by subdomain.

#### Response

Same as above, but returns a single club object.

#### Example

```bash
curl -X GET https://your-project.supabase.co/functions/v1/clubs/aqua-masters \
  -H "Authorization: Bearer <token>"
```

### Create Club

**POST** `/clubs`

Creates a new club with the authenticated user as owner.

#### Request Body

```typescript
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
```

#### Response

```typescript
interface CreateClubResponse {
  success: boolean
  data?: Club & { is_owner: true }
  error?: string
}
```

#### Example

```bash
curl -X POST https://your-project.supabase.co/functions/v1/clubs \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Aqua Masters",
    "subdomain": "aqua-masters",
    "description": "Premier swimming club",
    "contact_email": "info@aquamasters.com",
    "contact_phone": "(555) 123-4567",
    "address": "123 Pool Street",
    "city": "Swim City",
    "state": "CA",
    "zip_code": "90210"
  }'
```

### Update Club

**PUT** `/clubs/{id}`

Updates club details. Only the club owner can perform this action.

#### Request Body

```typescript
interface UpdateClubRequest {
  name?: string
  description?: string
  contact_email?: string
  contact_phone?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  logo_url?: string
  season_start?: string
  season_end?: string
}
```

#### Example

```bash
curl -X PUT https://your-project.supabase.co/functions/v1/clubs/1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated club description",
    "contact_email": "newemail@aquamasters.com"
  }'
```

---

## Member Management Endpoints

### Get Club Members

**GET** `/members?clubId={clubId}`

Retrieves all members for a specific club.

#### Query Parameters

- `clubId` (required): The ID of the club

#### Response

```typescript
interface MembersResponse {
  success: boolean
  data?: {
    id: number
    name: string
    subdomain: string
    members: {
      id: number
      user_id?: string
      first_name: string
      last_name: string
      email?: string
      phone?: string
      member_type: 'adult' | 'child' | 'family'
      membership_status: 'active' | 'inactive' | 'pending' | 'suspended'
      created_at: string
      updated_at: string
    }[]
  }
  error?: string
}
```

#### Example

```bash
curl -X GET "https://your-project.supabase.co/functions/v1/members?clubId=1" \
  -H "Authorization: Bearer <token>"
```

### Get All User's Clubs and Members

**GET** `/members`

Retrieves all clubs owned by the authenticated user with their members.

#### Response

Array of club objects with their members (same structure as above).

#### Example

```bash
curl -X GET https://your-project.supabase.co/functions/v1/members \
  -H "Authorization: Bearer <token>"
```

### Invite Member

**POST** `/clubs/invite`

Sends an invitation to join a club. Creates a new user account if the email doesn't exist.

#### Request Body

```typescript
interface InviteRequest {
  club_id: number
  email: string
  first_name: string
  last_name: string
  member_type: 'adult' | 'child' | 'family'
}
```

#### Response

```typescript
interface InviteResponse {
  success: boolean
  data?: {
    id: number
    club_id: number
    first_name: string
    last_name: string
    email: string
    member_type: 'adult' | 'child' | 'family'
    membership_status: 'pending'
    membership_start_date: string
    created_at: string
    updated_at: string
  }
  error?: string
}
```

#### Example

```bash
curl -X POST https://your-project.supabase.co/functions/v1/clubs/invite \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "club_id": 1,
    "email": "newmember@example.com",
    "first_name": "Jane",
    "last_name": "Smith",
    "member_type": "adult"
  }'
```

### Bulk Invite Members

**POST** `/clubs/bulk-invite`

Sends invitations to multiple members at once.

#### Request Body

```typescript
interface BulkInviteRequest {
  club_id: number
  members: {
    email: string
    first_name: string
    last_name: string
    member_type: 'adult' | 'child' | 'family'
  }[]
}
```

#### Response

```typescript
interface BulkInviteResponse {
  success: boolean
  data?: {
    successful: Member[]
    failed: {
      email: string
      error: string
    }[]
  }
  error?: string
}
```

#### Example

```bash
curl -X POST https://your-project.supabase.co/functions/v1/clubs/bulk-invite \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "club_id": 1,
    "members": [
      {
        "email": "member1@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "member_type": "adult"
      },
      {
        "email": "member2@example.com",
        "first_name": "Jane",
        "last_name": "Smith",
        "member_type": "adult"
      }
    ]
  }'
```

### Join Club

**POST** `/clubs/join`

Allows an authenticated user to join a club directly.

#### Request Body

```typescript
interface JoinClubRequest {
  club_id: number
}
```

#### Response

```typescript
interface JoinClubResponse {
  success: boolean
  data?: Member
  error?: string
}
```

#### Example

```bash
curl -X POST https://your-project.supabase.co/functions/v1/clubs/join \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "club_id": 1
  }'
```

### Complete Onboarding

**POST** `/clubs/onboarding`

Completes the member onboarding process using an invite token.

#### Request Body

```typescript
interface OnboardingRequest {
  invite_token: string
  first_name: string
  last_name: string
  phone?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
}
```

#### Response

```typescript
interface OnboardingResponse {
  success: boolean
  data?: Member
  error?: string
}
```

#### Example

```bash
curl -X POST https://your-project.supabase.co/functions/v1/clubs/onboarding \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "invite_token": "uuid-token-here",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "(555) 123-4567",
    "emergency_contact_name": "Jane Doe",
    "emergency_contact_phone": "(555) 987-6543"
  }'
```

### Confirm Invitation

**POST** `/clubs/confirm-invite`

Confirms an invitation acceptance for existing users.

#### Request Body

```typescript
interface ConfirmInviteRequest {
  token: string
}
```

#### Response

```typescript
interface ConfirmInviteResponse {
  success: boolean
  data?: Member
  error?: string
}
```

#### Example

```bash
curl -X POST https://your-project.supabase.co/functions/v1/clubs/confirm-invite \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "uuid-token-here"
  }'
```

---

## Event Management Endpoints

### Get Events

**GET** `/events`

Retrieves events for clubs where the user is a member.

#### Query Parameters

- `club_id` (optional): Filter by specific club
- `program_id` (optional): Filter by program
- `event_type` (optional): Filter by event type (`practice`, `competition`, `meeting`, `social`, `other`)
- `start_date` (optional): Filter events starting from this date
- `end_date` (optional): Filter events ending before this date
- `is_active` (optional): Filter by active status (`true`/`false`)
- `search` (optional): Search in event titles
- `sort_by` (optional): Sort field (default: `start_date`)
- `sort_order` (optional): Sort direction (`asc`/`desc`, default: `desc`)
- `page` (optional): Page number for pagination
- `limit` (optional): Number of items per page

#### Response

```typescript
interface EventsResponse {
  success: boolean
  data?: {
    id: number
    club_id: number
    program_id?: number
    title: string
    description?: string
    event_type: 'practice' | 'competition' | 'meeting' | 'social' | 'other'
    start_date: string
    end_date: string
    location?: string
    max_capacity?: number
    registration_deadline?: string
    price_member?: number
    price_non_member?: number
    is_active: boolean
    created_at: string
    updated_at: string
    clubs: {
      name: string
      subdomain: string
    }
    programs?: {
      name: string
      program_type: string
    }
  }[]
  error?: string
}
```

#### Example

```bash
curl -X GET "https://your-project.supabase.co/functions/v1/events?club_id=1&is_active=true" \
  -H "Authorization: Bearer <token>"
```

### Create Event

**POST** `/events`

Creates a new event. Only club owners can create events.

#### Request Body

```typescript
interface CreateEventRequest {
  club_id: number
  title: string
  description?: string
  event_type: 'practice' | 'competition' | 'meeting' | 'social' | 'other'
  start_date: string        // ISO datetime string
  end_date: string          // ISO datetime string
  location?: string
  max_capacity?: number
  registration_deadline?: string  // ISO datetime string
  price_member?: number
  price_non_member?: number
  program_id?: number
}
```

#### Response

```typescript
interface CreateEventResponse {
  success: boolean
  data?: Event
  error?: string
}
```

#### Example

```bash
curl -X POST https://your-project.supabase.co/functions/v1/events \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "club_id": 1,
    "title": "Weekly Practice",
    "description": "Regular team practice session",
    "event_type": "practice",
    "start_date": "2024-01-15T18:00:00Z",
    "end_date": "2024-01-15T20:00:00Z",
    "location": "Main Pool",
    "max_capacity": 30,
    "price_member": 10.00,
    "price_non_member": 15.00
  }'
```

### Update Event

**PUT** `/events/{id}`

Updates an existing event. Only club owners can update events.

#### Request Body

Same as CreateEventRequest, but all fields are optional.

#### Example

```bash
curl -X PUT https://your-project.supabase.co/functions/v1/events/1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Practice Session",
    "max_capacity": 35
  }'
```

### Delete Event

**DELETE** `/events/{id}`

Deletes an event. Only club owners can delete events.

#### Response

```typescript
interface DeleteEventResponse {
  success: boolean
  data?: {
    message: string
  }
  error?: string
}
```

#### Example

```bash
curl -X DELETE https://your-project.supabase.co/functions/v1/events/1 \
  -H "Authorization: Bearer <token>"
```

---

## Data Types

### Club

```typescript
interface Club {
  id: number
  name: string
  subdomain: string
  description?: string
  logo_url?: string
  contact_email?: string
  contact_phone?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  season_start?: string
  season_end?: string
  stripe_account_id?: string
  onboarding_completed: boolean
  owner_id?: string
  created_at: string
  updated_at: string
}
```

### Member

```typescript
interface Member {
  id: number
  club_id: number
  user_id?: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  date_of_birth?: string
  member_type: 'adult' | 'child' | 'family'
  parent_member_id?: number
  emergency_contact_name?: string
  emergency_contact_phone?: string
  membership_status: 'active' | 'inactive' | 'pending' | 'suspended'
  membership_start_date?: string
  created_at: string
  updated_at: string
}
```

### Event

```typescript
interface Event {
  id: number
  club_id: number
  program_id?: number
  title: string
  description?: string
  event_type: 'practice' | 'competition' | 'meeting' | 'social' | 'other'
  start_date: string
  end_date: string
  location?: string
  max_capacity?: number
  registration_deadline?: string
  price_member?: number
  price_non_member?: number
  is_active: boolean
  created_at: string
  updated_at: string
}
```

### User

```typescript
interface User {
  id: string
  club_id?: number
  role_id: number
  email: string
  first_name: string
  last_name: string
  phone?: string
  is_active: boolean
  created_at: string
  updated_at: string
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `PGRST116` | No rows returned (not an error, just empty result) |
| `23505` | Unique constraint violation |
| `23503` | Foreign key constraint violation |
| `23514` | Check constraint violation |

---

## Rate Limits

- **Authentication**: 10 requests per minute per IP
- **General API**: 100 requests per minute per user
- **Bulk Operations**: 10 requests per minute per user

---

## Webhooks (Future)

The API will support webhooks for:

- Member status changes
- Event registrations
- Payment completions
- Club updates

---

## SDK Examples

### JavaScript/TypeScript

```typescript
class LoopleAPI {
  private baseURL: string
  private token: string

  constructor(baseURL: string, token: string) {
    this.baseURL = baseURL
    this.token = token
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Request failed')
    }

    return data
  }

  // Club methods
  async getClubs() {
    return this.request<ApiResponse<Club[]>>('/clubs')
  }

  async createClub(clubData: CreateClubRequest) {
    return this.request<ApiResponse<Club>>('/clubs', {
      method: 'POST',
      body: JSON.stringify(clubData),
    })
  }

  // Member methods
  async getMembers(clubId?: number) {
    const url = clubId ? `/members?clubId=${clubId}` : '/members'
    return this.request<ApiResponse<Club>>(url)
  }

  async inviteMember(inviteData: InviteRequest) {
    return this.request<ApiResponse<Member>>('/clubs/invite', {
      method: 'POST',
      body: JSON.stringify(inviteData),
    })
  }

  // Event methods
  async getEvents(filters: EventFilters = {}) {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString())
      }
    })
    
    const url = params.toString() ? `/events?${params}` : '/events'
    return this.request<ApiResponse<Event[]>>(url)
  }

  async createEvent(eventData: CreateEventRequest) {
    return this.request<ApiResponse<Event>>('/events', {
      method: 'POST',
      body: JSON.stringify(eventData),
    })
  }
}

// Usage
const api = new LoopleAPI('https://your-project.supabase.co/functions/v1', 'your-jwt-token')

// Get user's clubs
const clubs = await api.getClubs()

// Create a new event
const event = await api.createEvent({
  club_id: 1,
  title: 'Team Practice',
  event_type: 'practice',
  start_date: '2024-01-15T18:00:00Z',
  end_date: '2024-01-15T20:00:00Z',
})
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react'

function useClubs(token: string) {
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchClubs() {
      try {
        setLoading(true)
        const response = await fetch('/functions/v1/clubs', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        
        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error)
        }
        
        setClubs(data.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch clubs')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      fetchClubs()
    }
  }, [token])

  return { clubs, loading, error }
}
```

---

## Testing

Use the provided Postman collection or test endpoints directly:

```bash
# Test authentication
curl -X POST https://your-project.supabase.co/functions/v1/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","data":{"first_name":"Test","last_name":"User"}}'

# Test club creation
curl -X POST https://your-project.supabase.co/functions/v1/clubs \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Club","subdomain":"test-club","description":"Test","contact_email":"test@test.com","contact_phone":"(555) 123-4567","address":"123 Test St","city":"Test City","state":"TS","zip_code":"12345"}'
```

---

## Support

For API support and questions:
- Check the error messages in responses
- Verify authentication tokens are valid
- Ensure required fields are provided
- Check club ownership for admin-only operations
