/**
 * NextAuth configuration for MailMate.
 *
 * Authentication strategy: JWT sessions (stateless, stored in a signed cookie).
 * This means no database reads are needed on every request — only when the
 * token expires and needs refreshing. This works for both single-instance and
 * multi-replica deployments.
 *
 * Provider: Google OAuth 2.0 with the following Gmail + Calendar scopes:
 *   - gmail.readonly / gmail.send / gmail.modify  — inbox operations
 *   - calendar / calendar.events                  — scheduling agent
 *
 * Token refresh: the jwt() callback silently refreshes the Google access token
 * when it expires using the stored refresh_token. A failed refresh leaves the
 * user signed in but without a valid access token (graceful degradation to
 * demo mode).
 *
 * User persistence: on every sign-in, the user record is upserted into the
 * database. Prisma is used when DATABASE_URL is set (Docker/self-host).
 * Supabase is used as a legacy fallback when only Supabase env vars are set.
 * If neither is configured the upsert is a no-op (demo mode).
 *
 * Custom pages:
 *   - /auth/signin  — branded sign-in page (not the NextAuth default)
 */
import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

// ── Google OAuth provider ──────────────────────────────────────────────────────

const providers: NextAuthOptions['providers'] = []

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
          ].join(' '),
          // offline access required for refresh tokens
          access_type: 'offline',
          // force consent screen every time so we always receive a refresh token
          prompt: 'consent',
        },
      },
    })
  )
}

// ── User upsert helper (Prisma → Supabase → no-op) ────────────────────────────

async function upsertUserRecord(user: {
  id: string
  email: string
  name: string
  image?: string
}): Promise<void> {
  // Prefer Prisma when DATABASE_URL is configured (Docker/self-host path)
  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import('./db')
      await prisma.user.upsert({
        where: { email: user.email },
        create: { id: user.id, email: user.email, name: user.name, avatarUrl: user.image },
        update: { name: user.name, avatarUrl: user.image },
      })
    } catch (e) {
      console.error('upsertUser (prisma) on sign-in:', e)
    }
    return
  }

  // Legacy fallback: Supabase (hackathon / Vercel deploy)
  try {
    const { upsertUser } = await import('./supabase')
    await upsertUser(user)
  } catch (e) {
    console.error('upsertUser (supabase) on sign-in:', e)
  }
}

// ── NextAuth options ───────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  providers,

  callbacks: {
    /**
     * jwt() runs on every token read/write.
     * - Initial sign-in (account truthy): capture access/refresh tokens.
     * - Subsequent calls: silently refresh if the access token has expired.
     */
    async jwt({ token, account, profile }) {
      // Capture tokens on initial Google sign-in
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
        token.userId = account.providerAccountId
      }

      // Proactive token refresh — exchange refresh_token for a new access_token
      // when the current one is expired or within 60 seconds of expiry
      const expiresAt = token.expiresAt as number | undefined
      if (expiresAt && Date.now() / 1000 > expiresAt - 60) {
        try {
          const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              grant_type: 'refresh_token',
              refresh_token: token.refreshToken as string,
            }),
          })
          const data = await response.json()
          if (data.access_token) {
            token.accessToken = data.access_token
            token.expiresAt = Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600)
          }
        } catch (error) {
          console.error('Token refresh failed:', error)
          // Deliberately not throwing — leave the old (expired) token in place
          // so the user sees a "re-authenticate" prompt rather than a hard crash
        }
      }

      // Persist profile fields for use in session()
      if (profile) {
        token.name = profile.name
        token.email = profile.email
        token.picture = (profile as Record<string, unknown>).picture as string | undefined
      }

      return token
    },

    /**
     * session() shapes the client-visible session object.
     * Exposes accessToken and userId so API routes and the client can use them
     * without decoding the JWT themselves.
     */
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      session.userId = token.userId as string
      if (session.user) {
        session.user.id = token.userId as string
      }
      return session
    },

    /**
     * signIn() runs once after a successful OAuth callback.
     * Upserts the user into the database (Prisma → Supabase → no-op).
     * Always returns true — a failed upsert is logged but doesn't block sign-in.
     */
    async signIn({ user, account }) {
      if (user && account) {
        await upsertUserRecord({
          id: account.providerAccountId,
          email: user.email ?? '',
          name: user.name ?? '',
          image: user.image ?? undefined,
        })
      }
      return true
    },
  },

  // JWT strategy: session stored in a signed, encrypted cookie — no DB reads per request
  session: { strategy: 'jwt' },

  pages: {
    signIn: '/auth/signin',
  },
}
