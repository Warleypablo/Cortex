import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { findUserById, createOrUpdateUser, type User } from "./userDb";

export function getCallbackURL(): string {
  // For Render, Railway, or other platforms - set APP_URL env var
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    return `${appUrl}/auth/google/callback`;
  }

  const customDomain = process.env.CUSTOM_DOMAIN;
  if (customDomain) {
    return `https://${customDomain}/auth/google/callback`;
  }

  // Render.com provides RENDER_EXTERNAL_URL
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  if (renderUrl) {
    return `${renderUrl}/auth/google/callback`;
  }

  const replitDomains = process.env.REPLIT_DOMAINS;
  if (replitDomains) {
    const firstDomain = replitDomains.split(',')[0].trim();
    if (firstDomain) {
      return `https://${firstDomain}/auth/google/callback`;
    }
  }

  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  if (devDomain) {
    return `https://${devDomain}/auth/google/callback`;
  }

  return "http://localhost:5000/auth/google/callback";
}

export function configurePassport() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret) {
    console.error("ERROR: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set for authentication");
    console.error("Please configure these environment variables in your hosting platform");
    return;
  }

  console.log("Google OAuth configured");

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL: getCallbackURL(),
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await createOrUpdateUser(profile);
          return done(null, user);
        } catch (error) {
          console.error("OAuth error:", error);
          return done(error as Error);
        }
      }
    )
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, (user as User).id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      // Dev user - não precisa buscar no banco
      if (id === "dev-admin-001") {
        const devUser: User = {
          id: "dev-admin-001",
          googleId: "dev-google-id",
          email: "warleyreserva4@gmail.com",
          name: "Dev Admin",
          picture: "",
          createdAt: new Date().toISOString(),
          role: "admin",
          allowedRoutes: [
            '/',
            '/contratos',
            '/colaboradores',
            '/colaboradores/analise',
            '/patrimonio',
            '/ferramentas',
            '/turbozap',
            '/visao-geral',
            '/dashboard/financeiro',
            '/dashboard/geg',
            '/dashboard/inhire',
            '/dashboard/recrutamento',
            '/dashboard/meta-ads',
            '/dashboard/retencao',
            '/dashboard/dfc',
            '/dashboard/auditoria-sistemas',
            '/admin/usuarios',
            '/admin/regras-notificacoes'
          ]
        };
        return done(null, devUser);
      }
      
      const user = await findUserById(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
}

export function logOAuthSetupInstructions() {
  console.log("OAuth callback URL:", getCallbackURL());
}
