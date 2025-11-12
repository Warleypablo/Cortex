import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { findUserById, createOrUpdateUser, type User } from "./userDb";

export function getCallbackURL(): string {
  const customDomain = process.env.CUSTOM_DOMAIN;
  if (customDomain) {
    return `https://${customDomain}/auth/google/callback`;
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
    console.warn("⚠️  Google OAuth credentials not found!");
    console.warn("⚠️  Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Secrets");
    return;
  }

  console.log("✅ Google OAuth configured successfully");
  console.log("📍 Client ID starts with:", clientID.substring(0, 20) + "...");
  console.log("📍 Callback URL:", getCallbackURL());

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL: getCallbackURL(),
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          console.log("👤 Perfil do Google recebido:", profile.id, profile.displayName);
          const user = await createOrUpdateUser(profile);
          console.log("✅ Usuário criado/atualizado:", user.id);
          return done(null, user);
        } catch (error) {
          console.error("❌ Erro ao criar/atualizar usuário:", error);
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
      const user = await findUserById(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
}

export function logOAuthSetupInstructions() {
  const callbackURL = getCallbackURL();
  
  console.log("\n" + "=".repeat(80));
  console.log("🔐 GOOGLE OAUTH SETUP INSTRUCTIONS");
  console.log("=".repeat(80));
  console.log("\n1. Go to Google Cloud Console: https://console.cloud.google.com/");
  console.log("2. Create or select a project");
  console.log("3. Enable Google+ API");
  console.log("4. Go to 'Credentials' → 'Create Credentials' → 'OAuth 2.0 Client ID'");
  console.log("5. Application type: Web application");
  console.log("\n6. Add this Authorized Redirect URI:");
  console.log(`   ✨ ${callbackURL}`);
  console.log("\n7. Copy your Client ID and Client Secret");
  console.log("8. Add them to Replit Secrets:");
  console.log("   - GOOGLE_CLIENT_ID");
  console.log("   - GOOGLE_CLIENT_SECRET");
  console.log("\n" + "=".repeat(80) + "\n");
}
