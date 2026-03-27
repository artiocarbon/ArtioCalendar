import { userCache, eventTypeCache, teamCache, credentialCache } from "./CacheManager";
import { prisma } from "@calcom/prisma";
import type { PrismaClient } from "@calcom/prisma/client";
import { safeCredentialSelect } from "@calcom/prisma/selects/credential";

/**
 * Cached repository functions for frequently accessed data
 */

export class CachedUserRepository {
  static async findById(id: number, prismaClient: PrismaClient = prisma) {
    const cacheKey = `user:${id}`;
    return userCache.getOrSet(
      cacheKey,
      async () => {
        return prismaClient.user.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatarUrl: true,
            locale: true,
            timeZone: true,
            timeFormat: true,
            weekStart: true,
            createdDate: true,
            completedOnboarding: true,
          },
        });
      },
      10 * 60 * 1000 // 10 minutes
    );
  }

  static async findByEmail(email: string, prismaClient: PrismaClient = prisma) {
    const cacheKey = `user:email:${email}`;
    return userCache.getOrSet(
      cacheKey,
      async () => {
        return prismaClient.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatarUrl: true,
            locale: true,
            timeZone: true,
          },
        });
      },
      10 * 60 * 1000
    );
  }

  static invalidateUser(id: number): void {
    userCache.delete(`user:${id}`);
  }
}

export class CachedEventTypeRepository {
  static async findById(id: number, prismaClient: PrismaClient = prisma) {
    const cacheKey = `eventType:${id}`;
    return eventTypeCache.getOrSet(
      cacheKey,
      async () => {
        return prismaClient.eventType.findUnique({
          where: { id },
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            length: true,
            schedulingType: true,
            userId: true,
            teamId: true,
            price: true,
            currency: true,
            requiresConfirmation: true,
            locations: true,
            metadata: true,
            bookingFields: true,
            position: true,
            hidden: true,
            disableCancelling: true,
            requiresBookerEmailVerification: true,
          },
        });
      },
      15 * 60 * 1000 // 15 minutes
    );
  }

  static async findByUserId(userId: number, prismaClient: PrismaClient = prisma) {
    const cacheKey = `eventType:user:${userId}`;
    return eventTypeCache.getOrSet(
      cacheKey,
      async () => {
        return prismaClient.eventType.findMany({
          where: { userId },
          select: {
            id: true,
            title: true,
            slug: true,
            length: true,
            schedulingType: true,
            position: true,
            hidden: true,
          },
          orderBy: { position: 'asc' },
        });
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
  static async findById(id: number, prismaClient: PrismaClient = prisma) {
    const cacheKey = `team:${id}`;
    return teamCache.getOrSet(
      cacheKey,
      async () => {
        return prismaClient.team.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            theme: true,
            brandColor: true,
            hideBranding: true,
            parentId: true,
          },
        });
      },
      10 * 60 * 1000
    );
  }

  static async findUserTeams(userId: number, prismaClient: PrismaClient = prisma) {
    const cacheKey = `team:user:${userId}`;
    return teamCache.getOrSet(
      cacheKey,
      async () => {
        const memberships = await prismaClient.membership.findMany({
          where: { userId },
          select: {
            team: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
              },
            },
            role: true,
          },
        });
        return memberships.map(m => ({ ...m.team, role: m.role }));
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
  static async findById(id: number, prismaClient: PrismaClient = prisma) {
    const cacheKey = `credential:${id}`;
    return credentialCache.getOrSet(
      cacheKey,
      async () => {
        return prismaClient.credential.findUnique({
          where: { id },
          select: safeCredentialSelect,
        });
      },
      5 * 60 * 1000 // 5 minutes for credentials
    );
  }

  static async findByUserId(userId: number, prismaClient: PrismaClient = prisma) {
    const cacheKey = `credential:user:${userId}`;
    return credentialCache.getOrSet(
      cacheKey,
      async () => {
        return prismaClient.credential.findMany({
          where: { userId },
          select: {
            id: true,
            type: true,
            appId: true,
            invalid: true,
          },
        });
      },
      2 * 60 * 1000 // 2 minutes for credential lists
    );
  }

  static async findByTeamId(teamId: number, prismaClient: PrismaClient = prisma) {
    const cacheKey = `credential:team:${teamId}`;
    return credentialCache.getOrSet(
      cacheKey,
      async () => {
        return prismaClient.credential.findMany({
          where: { teamId },
          select: {
            id: true,
            type: true,
            appId: true,
            invalid: true,
          },
        });
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
