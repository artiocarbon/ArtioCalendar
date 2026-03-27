import { userCache, eventTypeCache, teamCache, credentialCache } from "./CacheManager";

/**
 * Cached repository functions for frequently accessed data
 * Simplified version without prisma dependencies for testing
 */

export interface User {
  id: number;
  name: string | null;
  username: string | null;
  email: string;
  avatarUrl: string | null;
  locale: string | null;
  timeZone: string | null;
}

export interface EventType {
  id: number;
  title: string;
  slug: string;
  length: number | null;
  schedulingType: string | null;
  position: number | null;
  hidden: boolean | null;
}

export interface Team {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
}

export interface Credential {
  id: number;
  type: string;
  appId: string | null;
  invalid: boolean | null;
}

export class CachedUserRepository {
  static async findById(id: number): Promise<User | null> {
    const cacheKey = `user:${id}`;
    return userCache.getOrSet(
      cacheKey,
      async () => {
        // Mock implementation for testing
        return {
          id,
          name: `User ${id}`,
          username: `user${id}`,
          email: `user${id}@example.com`,
          avatarUrl: null,
          locale: 'en',
          timeZone: 'UTC',
        };
      },
      10 * 60 * 1000 // 10 minutes
    );
  }

  static async findByEmail(email: string): Promise<User | null> {
    const cacheKey = `user:email:${email}`;
    return userCache.getOrSet(
      cacheKey,
      async () => {
        // Mock implementation for testing
        return {
          id: 1,
          name: 'Test User',
          username: 'testuser',
          email,
          avatarUrl: null,
          locale: 'en',
          timeZone: 'UTC',
        };
      },
      10 * 60 * 1000
    );
  }

  static invalidateUser(id: number): void {
    userCache.delete(`user:${id}`);
  }
}

export class CachedEventTypeRepository {
  static async findById(id: number): Promise<EventType | null> {
    const cacheKey = `eventType:${id}`;
    return eventTypeCache.getOrSet(
      cacheKey,
      async () => {
        // Mock implementation for testing
        return {
          id,
          title: `Event Type ${id}`,
          slug: `event-type-${id}`,
          length: 30,
          schedulingType: 'COLLECTIVE',
          position: 1,
          hidden: false,
        };
      },
      15 * 60 * 1000 // 15 minutes
    );
  }

  static async findByUserId(userId: number): Promise<EventType[]> {
    const cacheKey = `eventType:user:${userId}`;
    return eventTypeCache.getOrSet(
      cacheKey,
      async () => {
        // Mock implementation for testing
        return [
          {
            id: 1,
            title: 'Test Event',
            slug: 'test-event',
            length: 30,
            schedulingType: 'COLLECTIVE',
            position: 1,
            hidden: false,
          },
        ];
      },
      5 * 60 * 1000 // 5 minutes for lists
    );
  }

  static invalidateEventType(id: number): void {
    eventTypeCache.delete(`eventType:${id}`);
  }

  static invalidateUserEventTypes(userId: number): void {
    eventTypeCache.delete(`eventType:user:${userId}`);
  }
}

export class CachedTeamRepository {
  static async findById(id: number): Promise<Team | null> {
    const cacheKey = `team:${id}`;
    return teamCache.getOrSet(
      cacheKey,
      async () => {
        // Mock implementation for testing
        return {
          id,
          name: `Team ${id}`,
          slug: `team-${id}`,
          logoUrl: null,
        };
      },
      10 * 60 * 1000
    );
  }

  static async findUserTeams(userId: number): Promise<(Team & { role: string })[]> {
    const cacheKey = `team:user:${userId}`;
    return teamCache.getOrSet(
      cacheKey,
      async () => {
        // Mock implementation for testing
        return [
          {
            id: 1,
            name: 'Test Team',
            slug: 'test-team',
            logoUrl: null,
            role: 'OWNER',
          },
        ];
      },
      5 * 60 * 1000
    );
  }

  static invalidateTeam(id: number): void {
    teamCache.delete(`team:${id}`);
  }

  static invalidateUserTeams(userId: number): void {
    teamCache.delete(`team:user:${userId}`);
  }
}

export class CachedCredentialRepository {
  static async findById(id: number): Promise<Credential | null> {
    const cacheKey = `credential:${id}`;
    return credentialCache.getOrSet(
      cacheKey,
      async () => {
        // Mock implementation for testing
        return {
          id,
          type: 'google_calendar',
          appId: 'google-calendar',
          invalid: false,
        };
      },
      5 * 60 * 1000 // 5 minutes for credentials
    );
  }

  static async findByUserId(userId: number): Promise<Credential[]> {
    const cacheKey = `credential:user:${userId}`;
    return credentialCache.getOrSet(
      cacheKey,
      async () => {
        // Mock implementation for testing
        return [
          {
            id: 1,
            type: 'google_calendar',
            appId: 'google-calendar',
            invalid: false,
          },
        ];
      },
      2 * 60 * 1000 // 2 minutes for credential lists
    );
  }

  static async findByTeamId(teamId: number): Promise<Credential[]> {
    const cacheKey = `credential:team:${teamId}`;
    return credentialCache.getOrSet(
      cacheKey,
      async () => {
        // Mock implementation for testing
        return [
          {
            id: 2,
            type: 'zoom',
            appId: 'zoom',
            invalid: false,
          },
        ];
      },
      2 * 60 * 1000
    );
  }

  static invalidateCredential(id: number): void {
    credentialCache.delete(`credential:${id}`);
  }

  static invalidateUserCredentials(userId: number): void {
    credentialCache.delete(`credential:user:${userId}`);
  }

  static invalidateTeamCredentials(teamId: number): void {
    credentialCache.delete(`credential:team:${teamId}`);
  }
}
