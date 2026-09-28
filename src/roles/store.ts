/**
 * In-memory user + content-ownership store. Pure TypeScript.
 * Swap for a DB-backed store later; the interface stays the same.
 */
import { AccessDeniedError, can, requireCapability, type Capability, type Role, type User } from "./types";

export interface AuthoredContent {
  id: string;
  /** problem | quiz | assignment | testcase-set */
  kind: "problem" | "quiz" | "assignment";
  title: string;
  createdBy: string;
  /** which roles may see this content; students always need content:view */
  visibleTo: Role[];
}

export class UserStore {
  private users = new Map<string, User>();
  private content = new Map<string, AuthoredContent>();

  addUser(user: User): User {
    this.users.set(user.id, user);
    return user;
  }

  getUser(id: string): User | null {
    return this.users.get(id) ?? null;
  }

  /** Only admins may change roles. */
  setUserRole(actorId: string, targetId: string, role: Role): User {
    const actor = this.users.get(actorId);
    if (!actor) throw new AccessDeniedError("unknown actor");
    requireCapability(actor, "user:manage");
    const target = this.users.get(targetId);
    if (!target) throw new Error(`no such user: ${targetId}`);
    target.role = role;
    return target;
  }

  /** Teachers (and admins) publish content. */
  publishContent(actorId: string, draft: Omit<AuthoredContent, "createdBy">): AuthoredContent {
    const actor = this.users.get(actorId);
    if (!actor) throw new AccessDeniedError("unknown actor");
    requireCapability(actor, `${draft.kind}:create` as Capability);
    const content: AuthoredContent = { ...draft, createdBy: actor.id };
    this.content.set(content.id, content);
    return content;
  }

  /** Only the author or an admin may edit content. */
  editContent(actorId: string, contentId: string, patch: Partial<Pick<AuthoredContent, "title" | "visibleTo">>): AuthoredContent {
    const actor = this.users.get(actorId);
    if (!actor) throw new AccessDeniedError("unknown actor");
    const content = this.content.get(contentId);
    if (!content) throw new Error(`no such content: ${contentId}`);
    if (content.createdBy !== actor.id && !can(actor, "user:manage")) {
      throw new AccessDeniedError("only the author or an admin can edit this content");
    }
    Object.assign(content, patch);
    return content;
  }

  /** Content a given user is allowed to see. */
  visibleContentFor(user: User): AuthoredContent[] {
    return [...this.content.values()].filter(
      (c) => c.createdBy === user.id || c.visibleTo.includes(user.role)
    );
  }

  listContent(): AuthoredContent[] {
    return [...this.content.values()];
  }

  listUsers(): User[] {
    return [...this.users.values()];
  }
}
