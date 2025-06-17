-- Drop and recreate types if needed
DROP TYPE IF EXISTS membership_status_enum CASCADE;
DROP TYPE IF EXISTS event_type_enum CASCADE;
DROP TYPE IF EXISTS member_type_enum CASCADE;

-- Create custom types
DO $$ BEGIN
    CREATE TYPE membership_status_enum AS ENUM ('active', 'inactive', 'pending', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE event_type_enum AS ENUM ('practice', 'competition', 'meeting', 'social', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE member_type_enum AS ENUM ('adult', 'child', 'family');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create tables with new structure
CREATE TABLE IF NOT EXISTS clubs (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    name text NOT NULL,
    subdomain text NOT NULL UNIQUE,
    description text,
    logo_url text,
    contact_email text,
    contact_phone text,
    address text,
    city text,
    state text,
    zip_code text,
    season_start date,
    season_end date,
    stripe_account_id text,
    onboarding_completed boolean DEFAULT false,
    owner_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT clubs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS roles (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    name text NOT NULL UNIQUE,
    description text,
    permissions jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT roles_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS users (
    id text NOT NULL,
    club_id bigint,
    role_id bigint NOT NULL,
    email text NOT NULL UNIQUE,
    first_name text NOT NULL,
    last_name text NOT NULL,
    phone text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id),
    CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS members (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    club_id bigint NOT NULL,
    user_id text,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text,
    phone text,
    date_of_birth date,
    member_type member_type_enum NOT NULL,
    parent_member_id bigint,
    emergency_contact_name text,
    emergency_contact_phone text,
    membership_status membership_status_enum DEFAULT 'active',
    membership_start_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT members_pkey PRIMARY KEY (id),
    CONSTRAINT members_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id),
    CONSTRAINT members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT members_parent_member_id_fkey FOREIGN KEY (parent_member_id) REFERENCES members(id)
);

CREATE TABLE IF NOT EXISTS programs (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    club_id bigint NOT NULL,
    name text NOT NULL,
    description text,
    program_type text NOT NULL,
    is_active boolean DEFAULT true,
    requires_approval boolean DEFAULT false,
    season_start timestamp with time zone,
    season_end timestamp with time zone,
    has_fees boolean DEFAULT true,
    registration_fee numeric,
    monthly_fee numeric,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT programs_pkey PRIMARY KEY (id),
    CONSTRAINT programs_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id)
);

CREATE TABLE IF NOT EXISTS events (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    club_id bigint NOT NULL,
    program_id bigint,
    title text NOT NULL,
    description text,
    event_type event_type_enum NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    location text,
    max_capacity integer,
    registration_deadline timestamp with time zone,
    price_member numeric,
    price_non_member numeric,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT events_pkey PRIMARY KEY (id),
    CONSTRAINT events_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id),
    CONSTRAINT events_program_id_fkey FOREIGN KEY (program_id) REFERENCES programs(id)
);

CREATE TABLE IF NOT EXISTS program_memberships (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    program_id bigint NOT NULL,
    member_id bigint NOT NULL,
    role text DEFAULT 'participant',
    status text DEFAULT 'active',
    joined_at timestamp with time zone DEFAULT now(),
    payment_status text DEFAULT 'pending',
    last_payment_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT program_memberships_pkey PRIMARY KEY (id),
    CONSTRAINT program_memberships_program_id_fkey FOREIGN KEY (program_id) REFERENCES programs(id),
    CONSTRAINT program_memberships_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE TABLE IF NOT EXISTS policy_logs (
    id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
    policy_name text,
    table_name text,
    operation text,
    user_id text,
    additional_info jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT policy_logs_pkey PRIMARY KEY (id)
);

-- Create updated_at function and triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_clubs_updated_at ON clubs;
DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_members_updated_at ON members;
DROP TRIGGER IF EXISTS update_programs_updated_at ON programs;
DROP TRIGGER IF EXISTS update_program_memberships_updated_at ON program_memberships;
DROP TRIGGER IF EXISTS update_events_updated_at ON events;

-- Create triggers
CREATE TRIGGER update_clubs_updated_at
    BEFORE UPDATE ON clubs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_members_updated_at
    BEFORE UPDATE ON members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_programs_updated_at
    BEFORE UPDATE ON programs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_program_memberships_updated_at
    BEFORE UPDATE ON program_memberships
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 