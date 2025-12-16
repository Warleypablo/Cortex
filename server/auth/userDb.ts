import { db } from "../db";
import { authUsers } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture: string;
  createdAt: string;
  role: 'admin' | 'user';
  allowedRoutes: string[];
}

const USER_CACHE_TTL_MS = 5 * 60 * 1000;
const userCache = new Map<string, { user: User; timestamp: number }>();
const googleIdCache = new Map<string, string>();

function getCachedUser(id: string): User | null {
  const cached = userCache.get(id);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > USER_CACHE_TTL_MS) {
    userCache.delete(id);
    return null;
  }
  
  return cached.user;
}

function setCachedUser(user: User): void {
  userCache.set(user.id, { user, timestamp: Date.now() });
  googleIdCache.set(user.googleId, user.id);
}

export function invalidateUserCache(userId: string): void {
  userCache.delete(userId);
}

export function clearUserCache(): void {
  userCache.clear();
  googleIdCache.clear();
}

const ADMIN_EMAILS = [
  'caio.massaroni@turbopartners.com.br',
  'warley.silva@turbopartners.com.br',
  'warleyreserva4@gmail.com'
];

const ALL_ROUTES = [
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
  '/dashboard/fluxo-caixa',
  '/dashboard/revenue-goals',
  '/dashboard/inadimplencia',
  '/dashboard/auditoria-sistemas',
  '/dashboard/tech',
  '/dashboard/comercial/closers',
  '/dashboard/comercial/sdrs',
  '/dashboard/comercial/detalhamento-closers',
  '/dashboard/comercial/detalhamento-vendas',
  '/dashboard/comercial/analise-vendas',
  '/dashboard/comercial/apresentacao',
  '/growth/visao-geral',
  '/growth/criativos',
  '/juridico/clientes',
  '/admin/usuarios'
];

const DEFAULT_USER_ROUTES = ['/ferramentas'];

function dbUserToUser(dbUser: typeof authUsers.$inferSelect): User {
  return {
    id: dbUser.id,
    googleId: dbUser.googleId,
    email: dbUser.email,
    name: dbUser.name,
    picture: dbUser.picture || '',
    createdAt: dbUser.createdAt?.toISOString() || new Date().toISOString(),
    role: dbUser.role as 'admin' | 'user',
    allowedRoutes: dbUser.allowedRoutes || DEFAULT_USER_ROUTES,
  };
}

export async function updateUserPermissions(userId: string, allowedRoutes: string[]): Promise<User | null> {
  try {
    const result = await db
      .update(authUsers)
      .set({ allowedRoutes })
      .where(eq(authUsers.id, userId))
      .returning();
    
    if (result.length === 0) return null;
    
    const user = dbUserToUser(result[0]);
    setCachedUser(user);
    return user;
  } catch (error) {
    console.error("Erro ao atualizar permissões:", error);
    return null;
  }
}

export async function updateUserRole(userId: string, role: 'admin' | 'user'): Promise<User | null> {
  try {
    const newRoutes = role === 'admin' ? ALL_ROUTES : DEFAULT_USER_ROUTES;
    
    const result = await db
      .update(authUsers)
      .set({ role, allowedRoutes: newRoutes })
      .where(eq(authUsers.id, userId))
      .returning();
    
    if (result.length === 0) return null;
    
    const user = dbUserToUser(result[0]);
    setCachedUser(user);
    return user;
  } catch (error) {
    console.error("Erro ao atualizar role:", error);
    return null;
  }
}

export async function getAllUsers(): Promise<User[]> {
  try {
    const result = await db.select().from(authUsers);
    const users = result.map(dbUserToUser);
    users.forEach(setCachedUser);
    return users;
  } catch (error) {
    console.error("Erro ao buscar todos os usuários:", error);
    return [];
  }
}

export async function findUserById(id: string): Promise<User | null> {
  try {
    const cached = getCachedUser(id);
    if (cached) return cached;
    
    const result = await db
      .select()
      .from(authUsers)
      .where(eq(authUsers.id, id))
      .limit(1);
    
    if (result.length === 0) return null;
    
    const user = dbUserToUser(result[0]);
    setCachedUser(user);
    return user;
  } catch (error) {
    console.error("Erro ao buscar usuário por id:", error);
    return null;
  }
}

export async function findUserByGoogleId(googleId: string): Promise<User | null> {
  try {
    const cachedUserId = googleIdCache.get(googleId);
    if (cachedUserId) {
      const cached = getCachedUser(cachedUserId);
      if (cached) return cached;
    }
    
    const result = await db
      .select()
      .from(authUsers)
      .where(eq(authUsers.googleId, googleId))
      .limit(1);
    
    if (result.length === 0) return null;
    
    const user = dbUserToUser(result[0]);
    setCachedUser(user);
    return user;
  } catch (error) {
    console.error("Erro ao buscar por Google ID:", error);
    return null;
  }
}

export async function createOrUpdateUser(profile: {
  id: string;
  emails?: Array<{ value: string }>;
  displayName: string;
  photos?: Array<{ value: string }>;
}): Promise<User> {
  const googleId = profile.id;
  const email = profile.emails?.[0]?.value || "";
  const name = profile.displayName;
  const picture = profile.photos?.[0]?.value || "";

  const isAdmin = ADMIN_EMAILS.includes(email);
  const existingUser = await findUserByGoogleId(googleId);

  if (existingUser) {
    const result = await db
      .update(authUsers)
      .set({
        email,
        name,
        picture,
        role: isAdmin ? 'admin' : existingUser.role,
        allowedRoutes: isAdmin ? ALL_ROUTES : (existingUser.allowedRoutes || DEFAULT_USER_ROUTES),
      })
      .where(eq(authUsers.id, existingUser.id))
      .returning();
    
    const user = dbUserToUser(result[0]);
    setCachedUser(user);
    return user;
  }

  const userId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const newUserData = {
    id: userId,
    googleId,
    email,
    name,
    picture,
    role: isAdmin ? 'admin' : 'user',
    allowedRoutes: isAdmin ? ALL_ROUTES : DEFAULT_USER_ROUTES,
  };

  await db.insert(authUsers).values(newUserData);
  
  const newUser: User = {
    ...newUserData,
    createdAt: new Date().toISOString(),
    role: newUserData.role as 'admin' | 'user',
  };
  
  setCachedUser(newUser);
  return newUser;
}

export async function listAllKeys(): Promise<string[]> {
  const users = await getAllUsers();
  return users.map(u => `user:${u.id}`);
}
