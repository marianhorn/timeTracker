# OAuth Setup Guide

## Google OAuth Configuration

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" and create OAuth 2.0 Client IDs
5. Configure authorized redirect URIs:
   - For development: `http://localhost:3000/api/oauth/google/callback`
   - For production: `https://yourdomain.com/api/oauth/google/callback`

6. Set environment variables:
   ```bash
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   SESSION_SECRET=your_session_secret
   ```


## Testing OAuth

1. Start the server with OAuth environment variables set
2. Go to `/login` page
3. Click "Continue with Google"
4. Complete OAuth flow
5. You should be redirected back with authentication

## Notes

- OAuth users don't have passwords - they authenticate via Google
- User databases are created automatically for new OAuth users
- If a user already exists with the same email, OAuth will be linked to the existing account
- OAuth is completely optional - users can always use email/password authentication

## Production Deployment

When deploying to production:
1. The deploy.sh script automatically includes OAuth support
2. Environment variables are pre-configured in `.env` (commented out)
3. Just uncomment and add your Google credentials
4. Restart: `sudo timetracker-restart`