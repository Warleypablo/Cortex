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
    const userId = await db.get(`${GOOGLE_ID_INDEX_PREFIX}${googleId}`);
    if (!userId) return null;
    return findUserById(String(userId));
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

  let existingUser = await findUserByGoogleId(googleId);

  if (existingUser) {
    existingUser.email = email;
    existingUser.name = name;
    existingUser.picture = picture;
    
    await db.set(`${USERS_PREFIX}${existingUser.id}`, JSON.stringify(existingUser));
    return existingUser;
  }

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

  return newUser;
}
