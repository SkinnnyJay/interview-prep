/**
 * In-memory mock user repository for demonstration and testing.
 * Keeps server.ts focused on wiring; replace with a real DB in production.
 */

import { User } from "../types/entities";
import type { AdvancedQuery, PaginatedResponse } from "../types/common";
import type { Repository } from "../services/crud-service";

export class MockUserRepository implements Repository<User> {
  private users = new Map<string, User>();
  private nextId = 1;

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findMany(query: AdvancedQuery): Promise<PaginatedResponse<User>> {
    const users = Array.from(this.users.values());
    const limit = query.pagination?.limit ?? 10;
    return {
      data: users.slice(0, limit),
      meta: {
        page: query.pagination?.page ?? 1,
        limit,
        total: users.length,
        totalPages: Math.ceil(users.length / limit) || 1,
        hasNext: false,
        hasPrev: false,
      },
    };
  }

  async create(entity: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    const user: User = {
      ...entity,
      id: `user-${this.nextId++}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async update(id: string, updates: Partial<User>, _version?: number): Promise<User> {
    const user = this.users.get(id);
    if (!user) throw new Error("User not found");

    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date(),
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async delete(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async bulkCreate(entities: Omit<User, "id" | "createdAt" | "updatedAt">[]): Promise<User[]> {
    return Promise.all(entities.map((entity) => this.create(entity)));
  }

  async bulkUpdate(updates: Array<{ id: string; data: Partial<User> }>): Promise<User[]> {
    return Promise.all(updates.map((update) => this.update(update.id, update.data)));
  }

  async bulkDelete(ids: string[]): Promise<number> {
    let deleted = 0;
    for (const id of ids) {
      if (this.users.delete(id)) deleted++;
    }
    return deleted;
  }

  async count(): Promise<number> {
    return this.users.size;
  }
}
