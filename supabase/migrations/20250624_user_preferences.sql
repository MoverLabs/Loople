-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    user_id text NOT NULL,
    notify_comments boolean DEFAULT true,
    notify_candidates boolean DEFAULT false,
    notify_offers boolean DEFAULT false,
    push_notifications text DEFAULT 'everything' CHECK (push_notifications IN ('everything', 'same_as_email', 'none')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_preferences_pkey PRIMARY KEY (id),
    CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT user_preferences_user_id_unique UNIQUE (user_id)
);

-- Create updated_at trigger for user_preferences
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
