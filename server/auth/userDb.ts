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
  'warley.silva@turbopartners.com.br'
];

// Emails externos permitidos (investidores, consultores, etc.)
const ALLOWED_EXTERNAL_EMAILS = [
  'ajame@icloud.com',
  'warleyreserva4@gmail.com'
];

// Rotas permitidas para usuários externos (apenas Investors Report)
export const EXTERNAL_USER_ROUTES = [
  '/investors-report'
];

export function isEmailAllowed(email: string): boolean {
  // Emails do domínio turbopartners são sempre permitidos
  if (email.endsWith('@turbopartners.com.br')) return true;
  // Emails na lista de admin são permitidos
  if (ADMIN_EMAILS.includes(email)) return true;
  // Emails externos na whitelist são permitidos
  if (ALLOWED_EXTERNAL_EMAILS.includes(email)) return true;
  return false;
}

export function isExternalEmail(email: string): boolean {
  return ALLOWED_EXTERNAL_EMAILS.includes(email);
}

// Verifica se o email é permitido para login externo (sem Google)
export function isExternalEmailAllowed(email: string): boolean {
  return ALLOWED_EXTERNAL_EMAILS.includes(email.toLowerCase().trim());
}

// Cria ou busca usuário externo (para login sem Google OAuth)
export async function createExternalUser(email: string): Promise<User> {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Buscar usuário existente pelo email COM googleId externo (criado via login externo)
  const existingUsers = await db
    .select()
    .from(authUsers)
    .where(eq(authUsers.email, normalizedEmail));
  
  // Verificar se já existe um usuário com este email
  const existingExternalUser = existingUsers.find(u => u.googleId.startsWith('external-'));
  
  if (existingExternalUser) {
    // Garantir que usuário externo sempre tem role "user" e rotas restritas
    await db
      .update(authUsers)
      .set({ 
        allowedRoutes: EXTERNAL_USER_ROUTES,
        role: 'user'
      })
      .where(eq(authUsers.id, existingExternalUser.id));
    
    const user: User = {
      ...dbUserToUser(existingExternalUser),
      role: 'user',
      allowedRoutes: EXTERNAL_USER_ROUTES
    };
    setCachedUser(user);
    return user;
  }
  
  // Criar novo usuário externo
  const userId = `ext-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const newUserData = {
    id: userId,
    googleId: `external-${normalizedEmail}`,
    email: normalizedEmail,
    name: normalizedEmail.split('@')[0],
    picture: '',
    role: 'user' as const,
    allowedRoutes: EXTERNAL_USER_ROUTES,
  };
  
  await db.insert(authUsers).values(newUserData);
  
  const newUser: User = {
    ...newUserData,
    createdAt: new Date().toISOString(),
  };
  
  setCachedUser(newUser);
  console.log(`✅ Novo usuário externo criado: ${normalizedEmail}`);
  return newUser;
}

const ALL_ROUTES = [
  '/clientes',
  '/contratos',
  '/colaboradores',
  '/colaboradores/analise',
  '/patrimonio',
  '/ferramentas',
  '/turbozap',
  '/acessos',
  '/conhecimentos',
  '/beneficios',
  '/cases/chat',
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
  '/tech/projetos',
  '/dashboard/comercial/closers',
  '/dashboard/comercial/sdrs',
  '/dashboard/comercial/detalhamento-closers',
  '/dashboard/comercial/detalhamento-sdrs',
  '/dashboard/comercial/detalhamento-vendas',
  '/dashboard/comercial/analise-vendas',
  '/dashboard/comercial/apresentacao',
  '/growth/visao-geral',
  '/growth/criativos',
  '/growth/performance-plataformas',
  '/juridico/clientes',
  '/investors-report',
  '/admin/usuarios',
  '/admin/regras-notificacoes',
  '/admin/logs'
];

// Rotas padrão para novos usuários @turbopartners.com.br
const DEFAULT_USER_ROUTES = [
  '/patrimonio',           // Patrimônio
  '/ferramentas',          // Turbo Tools
  '/cases/chat',           // GPTurbo
  '/conhecimentos',        // Conhecimento
  '/beneficios',           // Clube de Benefícios
  '/colaboradores/portal'  // Portal do Colaborador (acesso próprio)
];

// Migra permissões antigas ("/" -> "/clientes") automaticamente
function migrateAllowedRoutes(routes: string[] | null): string[] {
  if (!routes) return DEFAULT_USER_ROUTES;
  
  // Substituir "/" por "/clientes" para manter compatibilidade
  return routes.map(route => route === '/' ? '/clientes' : route);
}

function dbUserToUser(dbUser: typeof authUsers.$inferSelect): User {
  return {
    id: dbUser.id,
    googleId: dbUser.googleId,
    email: dbUser.email,
    name: dbUser.name,
    picture: dbUser.picture || '',
    createdAt: dbUser.createdAt?.toISOString() || new Date().toISOString(),
    role: dbUser.role as 'admin' | 'user',
    allowedRoutes: migrateAllowedRoutes(dbUser.allowedRoutes),
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

  // Verificar se o email é permitido
  if (!isEmailAllowed(email)) {
    throw new Error(`Email não autorizado: ${email}`);
  }

  const isAdmin = ADMIN_EMAILS.includes(email);
  const isExternal = isExternalEmail(email);
  const existingUser = await findUserByGoogleId(googleId);

  // Determinar rotas baseado no tipo de usuário
  const getUserRoutes = (existingRoutes?: string[]) => {
    if (isAdmin) return ALL_ROUTES;
    if (isExternal) return EXTERNAL_USER_ROUTES;
    return existingRoutes || DEFAULT_USER_ROUTES;
  };

  if (existingUser) {
    const result = await db
      .update(authUsers)
      .set({
        email,
        name,
        picture,
        role: isAdmin ? 'admin' : existingUser.role,
        allowedRoutes: getUserRoutes(existingUser.allowedRoutes),
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
    allowedRoutes: getUserRoutes(),
  };

  await db.insert(authUsers).values(newUserData);
  
  const newUser: User = {
    ...newUserData,
    createdAt: new Date().toISOString(),
    role: newUserData.role as 'admin' | 'user',
  };
  
  setCachedUser(newUser);
  console.log(`✅ Novo usuário criado: ${email} (${isExternal ? 'externo' : 'interno'})`);
  return newUser;
}

export async function listAllKeys(): Promise<string[]> {
  const users = await getAllUsers();
  return users.map(u => `user:${u.id}`);
}

export async function createManualUser(data: {
  name: string;
  email: string;
  role: 'admin' | 'user';
  allowedRoutes: string[];
}): Promise<User> {
  const normalizedEmail = data.email.toLowerCase().trim();
  
  const existingUsers = await db
    .select()
    .from(authUsers)
    .where(eq(authUsers.email, normalizedEmail));
  
  if (existingUsers.length > 0) {
    throw new Error(`Usuário com email ${normalizedEmail} já existe`);
  }
  
  const userId = `manual-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const routes = data.role === 'admin' ? ALL_ROUTES : data.allowedRoutes;
  
  const newUserData = {
    id: userId,
    googleId: `manual-${normalizedEmail}`,
    email: normalizedEmail,
    name: data.name,
    picture: '',
    role: data.role,
    allowedRoutes: routes,
  };
  
  await db.insert(authUsers).values(newUserData);
  
  const newUser: User = {
    ...newUserData,
    createdAt: new Date().toISOString(),
  };
  
  setCachedUser(newUser);
  console.log(`✅ Novo usuário manual criado: ${normalizedEmail}`);
  return newUser;
}
