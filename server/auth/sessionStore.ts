import { Store } from "express-session";
import Client from "@replit/database";

const db = new Client();
const SESSION_PREFIX = "session:";

interface SessionData {
  cookie: any;
  [key: string]: any;
}

export class ReplitSessionStore extends Store {
  async get(sid: string, callback: (err: any, session?: SessionData | null) => void) {
    try {
      const data = await db.get(`${SESSION_PREFIX}${sid}`);
      if (!data) {
        return callback(null, null);
      }
      const session = typeof data === 'string' ? JSON.parse(data) : data;
      callback(null, session);
    } catch (error) {
      callback(error);
    }
  }

  async set(sid: string, session: SessionData, callback?: (err?: any) => void) {
    try {
      await db.set(`${SESSION_PREFIX}${sid}`, JSON.stringify(session));
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  async destroy(sid: string, callback?: (err?: any) => void) {
    try {
      await db.delete(`${SESSION_PREFIX}${sid}`);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  async touch(sid: string, session: SessionData, callback?: (err?: any) => void) {
    try {
      await db.set(`${SESSION_PREFIX}${sid}`, JSON.stringify(session));
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }
}
