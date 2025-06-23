import { createClient } from '@supabase/supabase-js'

const INVITE_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #4CAF50;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      margin: 20px 0;
    }
    .footer { margin-top: 30px; font-size: 0.9em; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Welcome to {{ .data.club_name }}!</h2>
    
    <p>Hello {{ .data.first_name }},</p>
    
    <p>You have been invited to join {{ .data.club_name }}. We are excited to have you as part of our community!</p>
    
    <p>To accept this invitation and complete your registration, please click the button below:</p>
    
    <a href="{{ .ConfirmationURL }}" class="button">Accept Invitation</a>
    
    <p>Please note that this invitation link will expire in 7 days.</p>
    
    <div class="footer">
      <p>If you did not request this invitation, please ignore this email.</p>
      <p>This is an automated message, please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
`

async function updateEmailTemplates() {
  const projectId = process.env.SUPABASE_PROJECT_ID
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN

  if (!projectId || !accessToken) {
    throw new Error('Missing required environment variables')
  }

  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/email-templates/invite`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subject: 'Invitation to join {{ .data.club_name }}',
        content: INVITE_TEMPLATE,
        redirect_to: null
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to update template: ${JSON.stringify(error)}`)
    }

    console.log('✅ Email templates updated successfully')
  } catch (error) {
    console.error('❌ Failed to update email templates:', error)
    process.exit(1)
  }
}

updateEmailTemplates() 