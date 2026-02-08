-- Add media attachments support to posts

-- Create media attachments table
CREATE TABLE IF NOT EXISTS media_attachments (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    post_id bigint NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_size bigint NOT NULL,
    mime_type text NOT NULL,
    file_type text NOT NULL, -- 'image', 'video', 'document', etc.
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT media_attachments_pkey PRIMARY KEY (id),
    CONSTRAINT media_attachments_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_media_attachments_post_id ON media_attachments(post_id);
CREATE INDEX IF NOT EXISTS idx_media_attachments_file_type ON media_attachments(file_type);

-- Create updated_at trigger for media_attachments
CREATE TRIGGER update_media_attachments_updated_at 
    BEFORE UPDATE ON media_attachments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

