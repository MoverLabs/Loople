-- Create function to handle invite confirmation transaction
CREATE OR REPLACE FUNCTION confirm_club_invite(
  p_member_id INTEGER,
  p_club_id INTEGER,
  p_user_id UUID
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member json;
BEGIN
  -- Start transaction
  BEGIN
    -- Update member status to active
    UPDATE members
    SET 
      membership_status = 'active',
      user_id = p_user_id,
      updated_at = NOW()
    WHERE id = p_member_id
    AND club_id = p_club_id
    RETURNING json_build_object(
      'id', id,
      'club_id', club_id,
      'first_name', first_name,
      'last_name', last_name,
      'email', email,
      'member_type', member_type,
      'membership_status', membership_status,
      'membership_start_date', membership_start_date,
      'user_id', user_id,
      'created_at', created_at,
      'updated_at', updated_at
    ) INTO v_member;

    -- Create club-user association with member role
    INSERT INTO users_clubs (user_id, club_id, role_id)
    SELECT 
      p_user_id,
      p_club_id,
      r.id
    FROM roles r
    WHERE r.name = 'member'
    ON CONFLICT (user_id, club_id) DO NOTHING;

    -- Return the updated member
    RETURN v_member;
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback transaction on error
      RAISE EXCEPTION 'Failed to confirm invite: %', SQLERRM;
  END;
END;
$$; 