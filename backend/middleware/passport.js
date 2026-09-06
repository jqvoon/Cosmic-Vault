import passport from 'passport';

import { findOrCreateUser } from '../utils/authHelper.js';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';

// Google Stretegy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback'
}, async(accessToken, refreshToken, profile, done) => {
  // profile contains the Google user info
  // find or create the user
  try {
    const user = await findOrCreateUser({
      provider: 'google',
      providerId: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      avatar:  profile.photos?.[0]?.value || null
    });
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

// GitHub strategy
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: '/auth/github/callback'
}, async(accessToken, refreshToken, profile, done) => {
  try {
    const user = await findOrCreateUser({
      provider: 'github',
      providerId: profile.id,
      email: profile.emails?.[0]?.value || null,
      name: profile.displayName || profile.username,
      avatar: profile._json?.avatar_url || null
    });
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

export default passport;
