-- Insert default roles with permissions
INSERT INTO roles (name, description, permissions, is_active, created_at, updated_at)
VALUES 
    (
        'Admin',
        '',
        '{
            "can_manage_club": true,
            "can_manage_members": true,
            "can_manage_programs": true
        }'::jsonb,
        true,
        '2025-06-12 10:29:09.461989+00',
        '2025-06-12 10:29:09.461989+00'
    ),
    (
        'Member',
        '',
        '{
            "can_manage_members": false,
            "can_manage_programs": false
        }'::jsonb,
        true,
        '2025-06-12 10:29:40.347496+00',
        '2025-06-12 10:29:40.347496+00'
    ),
    (
        'Swimmer',
        '',
        '{
            "can_manage_members": false,
            "can_manage_programs": false
        }'::jsonb,
        true,
        '2025-06-12 10:30:01.237754+00',
        '2025-06-12 10:30:01.237754+00'
    )
ON CONFLICT (name) 
DO UPDATE SET 
    description = EXCLUDED.description,
    permissions = EXCLUDED.permissions,
    is_active = EXCLUDED.is_active;
