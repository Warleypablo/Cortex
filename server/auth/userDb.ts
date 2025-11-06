import Client from "@replit/database";

const db = new Client();

export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture: string;
  createdAt: string;
}

const USERS_PREFIX = "user:";
const GOOGLE_ID_INDEX_PREFIX = "googleId:";

export async function findUserById(id: string): Promise<User | null> {
  try {
    const userData = await db.get(`${USERS_PREFIX}${id}`);
    if (!userData) return null;
    return (typeof userData === 'string' ? JSON.parse(userData) : userData) as User;
  } catch (error) {
    console.error("Error finding user by id:", error);
    return null;
  }
}

export async function findUserByGoogleId(googleId: string): Promise<User | null> {
  try {
    const userIdData = await db.get(`${GOOGLE_ID_INDEX_PREFIX}${googleId}`);
    if (!userIdData) return null;
    const userId = typeof userIdData === 'string' ? userIdData : String(userIdData);
    return findUserById(userId);
  } catch (error) {
    console.error("Error finding user by Google ID:", error);
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

  const existingUser = await findUserByGoogleId(googleId);

  if (existingUser) {
    console.log("Atualizando usuário existente:", existingUser.id);
    const updatedUser: User = {
      ...existingUser,
      email,
      name,
      picture,
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
  };

  await db.set(`${USERS_PREFIX}${userId}`, JSON.stringify(newUser));
  await db.set(`${GOOGLE_ID_INDEX_PREFIX}${googleId}`, userId);
  console.log("Novo usuário criado:", userId);

  return newUser;
}
