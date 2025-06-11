// Enums
export enum ConversationType {
  DIRECT = 'direct',
  GROUP = 'group',
  ANNOUNCEMENT = 'announcement'
}

export enum EventType {
  PRACTICE = 'practice',
  MEET = 'meet',
  FUNDRAISER = 'fundraiser',
  SOCIAL = 'social'
}

export enum MemberType {
  INDIVIDUAL = 'individual',
  FAMILY_PRIMARY = 'family_primary',
  FAMILY_DEPENDENT = 'family_dependent'
}

export enum MembershipStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

export enum MessageContentType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file'
}

export enum ParticipantRole {
  ADMIN = 'admin',
  MEMBER = 'member',
  READ_ONLY = 'read_only'
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

export enum RegistrationStatus {
  REGISTERED = 'registered',
  WAITLIST = 'waitlist',
  CANCELLED = 'cancelled'
}

// Database Tables
// clubs table
export interface Club {
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
  season_start?: Date
  season_end?: Date
  stripe_account_id?: string
  onboarding_completed: boolean
  owner_id?: string
  created_at: Date
  updated_at: Date
}

// events table
export interface Event {
  id: number
  club_id: number
  program_id?: number
  title: string
  description?: string
  event_type: EventType
  start_date: Date
  end_date: Date
  location?: string
  max_capacity?: number
  registration_deadline?: Date
  price_member?: number
  price_non_member?: number
  is_active: boolean
  created_at: Date
  updated_at: Date
}

// members table
export interface Member {
  id: number
  club_id: number
  user_id?: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  date_of_birth?: Date
  member_type: MemberType
  parent_member_id?: number
  emergency_contact_name?: string
  emergency_contact_phone?: string
  membership_status: MembershipStatus
  membership_start_date?: Date
  created_at: Date
  updated_at: Date
}

// program_memberships table
export interface ProgramMembership {
  id: number
  program_id: number
  member_id: number
  role: string
  status: string
  joined_at: Date
  payment_status: string
  last_payment_date?: Date
  created_at: Date
  updated_at: Date
}

// programs table
export interface Program {
  id: number
  club_id: number
  name: string
  description?: string
  program_type: string
  is_active: boolean
  requires_approval: boolean
  season_start?: Date
  season_end?: Date
  has_fees: boolean
  registration_fee?: number
  monthly_fee?: number
  settings: Record<string, any>
  created_at: Date
  updated_at: Date
}

// roles table
export interface Role {
  id: number
  name: string
  description?: string
  permissions: Record<string, any>
  is_active: boolean
  created_at: Date
  updated_at: Date
}

// users table
export interface User {
  id: string
  club_id: number
  role_id: number
  email: string
  first_name: string
  last_name: string
  phone?: string
  is_active: boolean
  created_at: Date
  updated_at: Date
}

// Database Views and Helper Types
export interface ClubMember {
  club_id: number
  user_id: string
  role: ParticipantRole
  created_at: Date
  updated_at: Date
}

// Request/Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Common Types
export interface PaginationParams {
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface DateRange {
  start_date: Date
  end_date: Date
}

// Type Guards
export function isClub(obj: any): obj is Club {
  return obj && typeof obj.id === 'number' && typeof obj.name === 'string'
}

export function isEvent(obj: any): obj is Event {
  return obj && typeof obj.id === 'number' && typeof obj.title === 'string'
}

export function isMember(obj: any): obj is Member {
  return obj && typeof obj.id === 'number' && typeof obj.first_name === 'string'
}

export function isUser(obj: any): obj is User {
  return obj && typeof obj.id === 'string' && typeof obj.email === 'string'
} 