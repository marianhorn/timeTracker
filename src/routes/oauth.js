const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const router = express.Router();

// Configure Google OAuth strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/api/oauth/google/callback"
    }, async (accessToken, refreshToken, profile, done) => {
        // The strategy will be configured with the actual authService instance in the main app
        return done(null, { profile, accessToken, refreshToken });
    }));
}

// Google OAuth routes
router.get('/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
    passport.authenticate('google', { session: false }),
    async (req, res) => {
        try {
            const oauthData = req.user;
            const authService = req.app.locals.authService;
            
            // Extract user info from Google profile
            const userData = {
                username: oauthData.profile.displayName || oauthData.profile.emails[0].value.split('@')[0],
                email: oauthData.profile.emails[0].value,
                provider: 'google',
                providerId: oauthData.profile.id
            };
            
            // Create or get existing OAuth user
            const user = await authService.createOAuthUser(userData);
            
            // Generate JWT token
            const token = authService.generateToken(user.id);
            
            // Redirect to main app with token
            res.redirect(`/?token=${token}&user=${encodeURIComponent(JSON.stringify(user.toSafeJSON()))}`);
        } catch (error) {
            console.error('OAuth callback error:', error);
            res.redirect('/login?error=oauth_failed');
        }
    }
);


module.exports = router;