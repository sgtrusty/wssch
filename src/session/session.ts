import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../lib/logger.js";
import type { Session, SessionMessage } from "../core/types.js";

const SESSION_DIR = "/home/user/.localdata/sessions";

export class SessionManager {
  private currentSession: Session | null = null;
  private persist: boolean = true;

  constructor(persist: boolean = true) {
    this.persist = persist;
    if (this.persist && !existsSync(SESSION_DIR)) {
      mkdirSync(SESSION_DIR, { recursive: true });
    }
  }

  async create(): Promise<Session> {
    const session: Session = {
      id: randomUUID(),
      createdAt: Date.now(),
      messages: []
    };

    this.currentSession = session;
    
    if (this.persist) {
      this.saveSession(session);
    }

    return session;
  }

  async resume(sessionId: string): Promise<Session | null> {
    if (this.persist) {
      const session = this.loadSession(sessionId);
      if (session) {
        this.currentSession = session;
        return session;
      }
    }
    return null;
  }

  async addMessage(role: SessionMessage["role"], content: string): Promise<void> {
    if (!this.currentSession) {
      await this.create();
    }

    const message: SessionMessage = {
      role,
      content,
      timestamp: Date.now()
    };

    this.currentSession!.messages.push(message);

    if (this.persist) {
      this.saveSession(this.currentSession!);
    }
  }

  getCurrent(): Session | null {
    return this.currentSession;
  }

  getMessages(): SessionMessage[] {
    return this.currentSession?.messages || [];
  }

  async close(): Promise<void> {
    if (this.currentSession && this.persist) {
      this.saveSession(this.currentSession);
    }
    this.currentSession = null;
  }

  async list(): Promise<Session[]> {
    if (!this.persist || !existsSync(SESSION_DIR)) {
      return this.currentSession ? [this.currentSession] : [];
    }

    const sessions: Session[] = [];
    
    return sessions;
  }

  private sessionFilePath(sessionId: string): string {
    return join(SESSION_DIR, `${sessionId}.json`);
  }

  private saveSession(session: Session): void {
    try {
      writeFileSync(
        this.sessionFilePath(session.id),
        JSON.stringify(session, null, 2)
      );
    } catch (err) {
      logger.fail("session", `Failed to save: ${err}`);
    }
  }

  private loadSession(sessionId: string): Session | null {
    try {
      const path = this.sessionFilePath(sessionId);
      if (!existsSync(path)) {
        return null;
      }
      return JSON.parse(readFileSync(path, "utf-8"));
    } catch {
      return null;
    }
  }
}

export function createSessionManager(persist?: boolean): SessionManager {
  return new SessionManager(persist);
}