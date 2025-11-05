import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const sql = neon(databaseUrl);
const db = drizzle(sql, { schema });

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await db.query.authUsers.findFirst({
      where: eq(schema.authUsers.id, id),
    });

    if (!user) {
      return done(null, false);
    }

    const permissions = await db.query.userPermissions.findMany({
      where: eq(schema.userPermissions.userId, id),
    });

    const userWithPermissions = {
      ...user,
      permissions: permissions.map((p) => p.pageName),
    };

    done(null, userWithPermissions);
  } catch (error) {
    done(error);
  }
});

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback";

if (googleClientId && googleClientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: googleCallbackUrl,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;

          if (!email) {
            return done(new Error("No email found in Google profile"));
          }

          let user = await db.query.authUsers.findFirst({
            where: eq(schema.authUsers.googleId, profile.id),
          });

          if (!user) {
            user = await db.query.authUsers.findFirst({
              where: eq(schema.authUsers.email, email),
            });

            if (user) {
              [user] = await db
                .update(schema.authUsers)
                .set({ googleId: profile.id })
                .where(eq(schema.authUsers.id, user.id))
                .returning();
            }
          }

          if (!user) {
            [user] = await db
              .insert(schema.authUsers)
              .values({
                email,
                name: profile.displayName,
                avatar: profile.photos?.[0]?.value,
                googleId: profile.id,
                role: "user",
              })
              .returning();

            await db.insert(schema.userPermissions).values({
              userId: user.id,
              pageName: "ferramentas",
              canAccess: 1,
            });
          }

          const permissions = await db.query.userPermissions.findMany({
            where: eq(schema.userPermissions.userId, user.id),
          });

          const userWithPermissions = {
            ...user,
            permissions: permissions.map((p) => p.pageName),
          };

          return done(null, userWithPermissions);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
}

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        const user = await db.query.authUsers.findFirst({
          where: eq(schema.authUsers.email, email),
        });

        if (!user) {
          return done(null, false, { message: "Email ou senha incorretos" });
        }

        if (!user.passwordHash) {
          return done(null, false, {
            message: "Esta conta usa login social. Use o botão Google.",
          });
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          return done(null, false, { message: "Email ou senha incorretos" });
        }

        const permissions = await db.query.userPermissions.findMany({
          where: eq(schema.userPermissions.userId, user.id),
        });

        const userWithPermissions = {
          ...user,
          permissions: permissions.map((p) => p.pageName),
        };

        return done(null, userWithPermissions);
      } catch (error) {
        return done(error);
      }
    }
  )
);

export default passport;
