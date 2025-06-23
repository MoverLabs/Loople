import { createClient } from '@supabase/supabase-js'

const SHARED_STYLES = `
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
`

const INVITE_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  <div class="container">
    <h2>Welcome to {{ .data.club_name }}!</h2>
    
    <p>Hello {{ .data.first_name }},</p>
    
    <p>You have been invited to join {{ .data.club_name }}. We are excited to have you as part of our community!</p>
    
    <p>Since you already have an account, you can click the button below to accept this invitation:</p>
    
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

const MAGIC_LINK_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  <div class="container">
    <h2>Welcome to {{ .data.club_name }}!</h2>
    
    <p>Hello {{ .data.first_name }},</p>
    
    <p>You have been invited to join {{ .data.club_name }}. We are excited to have you as part of our community!</p>
    
    <p>To get started, click the button below to set up your account and accept the invitation:</p>
    
    <a href="{{ .ConfirmationURL }}" class="button">Set Up Account & Accept Invitation</a>
    
    <p>Please note:</p>
    <ul>
      <li>This link will expire in 24 hours</li>
      <li>You'll be asked to create a password for your account</li>
      <li>After setting up your account, you'll automatically be redirected to accept the club invitation</li>
    </ul>
    
    <div class="footer">
      <p>If you did not request this invitation, please ignore this email.</p>
      <p>This is an automated message, please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
`

// Get environment variables
const { SUPABASE_PROJECT_ID, SUPABASE_ACCESS_TOKEN } = process.env

if (!SUPABASE_PROJECT_ID || !SUPABASE_ACCESS_TOKEN) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

// Update email templates
fetch(`https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_ID}/config/auth`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    auth: {
      email_templates: {
        invite: {
          subject: 'Invitation to join {{ .data.club_name }}',
          content: {
            html: INVITE_TEMPLATE
          }
        },
        magic_link: {
          subject: 'Set up your account for {{ .data.club_name }}',
          content: {
            html: MAGIC_LINK_TEMPLATE
          }
        }
      }
    }
  })
})
.then(response => {
  if (!response.ok) {
    return response.json().then(error => {
      throw new Error(`Failed to update template: ${JSON.stringify(error)}`)
    })
  }
  console.log('✅ Email templates updated successfully')
})
.catch(error => {
  console.error('❌ Failed to update email templates:', error)
  process.exit(1)
}) 