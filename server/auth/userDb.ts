import Client from "@replit/database";

const db = new Client();

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

const USERS_PREFIX = "user:";
const GOOGLE_ID_INDEX_PREFIX = "googleId:";

export async function updateUserPermissions(userId: string, allowedRoutes: string[]): Promise<User | null> {
  try {
    const user = await findUserById(userId);
    if (!user) {
      return null;
    }
    
    const updatedUser: User = {
      ...user,
      allowedRoutes,
    };
    
    await db.set(`${USERS_PREFIX}${userId}`, JSON.stringify(updatedUser));
    return updatedUser;
  } catch (error) {
    console.error("❌ Erro ao atualizar permissões:", error);
    return null;
  }
}

export async function updateUserRole(userId: string, role: 'admin' | 'user'): Promise<User | null> {
  try {
    const user = await findUserById(userId);
    if (!user) {
      return null;
    }
    
    const updatedUser: User = {
      ...user,
      role,
      allowedRoutes: role === 'admin' ? ALL_ROUTES : DEFAULT_USER_ROUTES,
    };
    
    await db.set(`${USERS_PREFIX}${userId}`, JSON.stringify(updatedUser));
    return updatedUser;
  } catch (error) {
    console.error("❌ Erro ao atualizar role:", error);
    return null;
  }
}

export async function listAllKeys(): Promise<string[]> {
  try {
    const result: any = await db.list();
    const keys = result.value || result;
    return Array.isArray(keys) ? keys : [];
  } catch (error) {
    console.error("❌ Erro ao listar chaves:", error);
    return [];
  }
}

export async function getAllUsers(): Promise<User[]> {
  try {
    const result: any = await db.list(USERS_PREFIX);
    const keys = result.value || result;
    const users: User[] = [];
    
    if (!Array.isArray(keys)) {
      return [];
    }
    
    for (const key of keys) {
      const userResult: any = await db.get(key);
      if (userResult && userResult.ok !== false) {
        const userData = userResult.value || userResult;
        const parsedUser = (typeof userData === 'string' ? JSON.parse(userData) : userData) as User;
        users.push(parsedUser);
      }
    }
    
    return users;
  } catch (error) {
    console.error("❌ Erro ao buscar todos os usuários:", error);
    return [];
  }
}

export async function findUserById(id: string): Promise<User | null> {
  try {
    console.log("🔍 Buscando usuário por ID:", id);
    const result: any = await db.get(`${USERS_PREFIX}${id}`);
    console.log("📦 Dados brutos do DB:", result, "Tipo:", typeof result);
    
    if (!result || (result.ok === false)) {
      console.log("❌ Usuário não encontrado");
      return null;
    }
    
    const userData = result.value || result;
    const parsedUser = (typeof userData === 'string' ? JSON.parse(userData) : userData) as User;
    console.log("✅ Usuário parseado:", parsedUser);
    return parsedUser;
  } catch (error) {
    console.error("❌ Erro ao buscar usuário por id:", error);
    return null;
  }
}

export async function findUserByGoogleId(googleId: string): Promise<User | null> {
  try {
    console.log("🔍 Buscando por Google ID:", googleId);
    const result: any = await db.get(`${GOOGLE_ID_INDEX_PREFIX}${googleId}`);
    console.log("📦 User ID retornado:", result, "Tipo:", typeof result);
    
    if (!result || (result.ok === false)) {
      console.log("❌ Nenhum usuário encontrado para este Google ID");
      return null;
    }
    
    const userIdData = result.value || result;
    const userId = typeof userIdData === 'string' ? userIdData : String(userIdData);
    console.log("📝 User ID string:", userId);
    return findUserById(userId);
  } catch (error) {
    console.error("❌ Erro ao buscar por Google ID:", error);
    return null;
  }
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
  '/dashboard/auditoria-sistemas',
  '/admin/usuarios'
];
const DEFAULT_USER_ROUTES = ['/ferramentas'];

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
    console.log("Atualizando usuário existente:", existingUser.id);
    const updatedUser: User = {
      ...existingUser,
      email,
      name,
      picture,
      role: isAdmin ? 'admin' : existingUser.role,
      allowedRoutes: isAdmin ? ALL_ROUTES : (existingUser.allowedRoutes || DEFAULT_USER_ROUTES),
    };
    
    await db.set(`${USERS_PREFIX}${existingUser.id}`, JSON.stringify(updatedUser));
    console.log("Usuário atualizado com sucesso");
    return updatedUser;
  }

  console.log("Criando novo usuário...");
  const userId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const newUser: User = {
    id: userId,
    googleId,
    email,
    name,
    picture,
    createdAt: new Date().toISOString(),
    role: isAdmin ? 'admin' : 'user',
    allowedRoutes: isAdmin ? ALL_ROUTES : DEFAULT_USER_ROUTES,
  };

  await db.set(`${USERS_PREFIX}${userId}`, JSON.stringify(newUser));
  await db.set(`${GOOGLE_ID_INDEX_PREFIX}${googleId}`, userId);
  console.log("Novo usuário criado:", userId);

  return newUser;
}
