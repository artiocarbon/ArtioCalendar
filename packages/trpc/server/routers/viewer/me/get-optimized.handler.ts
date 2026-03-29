import { PermissionCheckService } from "@calcom/features/pbac/services/permission-check.service";
import { ProfileRepository } from "@calcom/features/profile/repositories/ProfileRepository";
import { UserRepository } from "@calcom/features/users/repositories/UserRepository";
import { getUserAvatarUrl } from "@calcom/lib/getAvatarUrl";
import prisma from "@calcom/prisma";
import { IdentityProvider, MembershipRole } from "@calcom/prisma/enums";
import { userMetadata } from "@calcom/prisma/zod-utils";
import type { TrpcSessionUser } from "@calcom/trpc/server/types";
import type { Session } from "next-auth";
import type { TGetInputSchema } from "./get.schema";

type MeOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
    session: Session;
  };
  input: TGetInputSchema;
};

/**
 * Optimized version of getHandler that combines multiple database queries
 * to reduce round trips and improve performance.
 */
export const getOptimizedHandler = async ({ ctx, input }: MeOptions) => {
  const crypto = await import("node:crypto");
  const { user: sessionUser, session } = ctx;

  // Combine multiple queries into parallel operations
  const [
    allUserEnrichedProfiles,
    secondaryEmails,
    userWithPassword,
    account,
    permissionCheckResult
  ] = await Promise.all([
    // Profile enrichment (can be parallel)
    ProfileRepository.findAllProfilesForUserIncludingMovedUser(sessionUser),
    
    // Secondary emails (can be parallel)
    prisma.secondaryEmail.findMany({
      where: { userId: sessionUser.id },
      select: {
        id: true,
        email: true,
        emailVerified: true,
      },
    }),
    
    // Password check (conditional, can be parallel)
    input?.includePasswordAdded && sessionUser.identityProvider !== IdentityProvider.CAL
      ? prisma.user.findUnique({
          where: { id: sessionUser.id },
          select: { password: { select: { hash: true } } },
        })
      : Promise.resolve(null),
    
    // Identity provider email (conditional, can be parallel)
    sessionUser.identityProviderId
      ? prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider:
                sessionUser.identityProvider === IdentityProvider.AZUREAD
                  ? "azure-ad"
                  : sessionUser.identityProvider.toLowerCase(),
              providerAccountId: sessionUser.identityProviderId,
            },
          },
          select: { providerEmail: true },
        })
      : Promise.resolve(null),
    
    // Permission check (can be parallel)
    new PermissionCheckService().getTeamIdsWithPermission({
      userId: sessionUser.id,
      permission: "team.update",
      fallbackRoles: [MembershipRole.ADMIN, MembershipRole.OWNER],
    }),
  ]);

  // Enrich user with profile (this might still need to be sequential due to dependency)
  const user = await new UserRepository(prisma).enrichUserWithTheProfile({
    user: sessionUser,
    upId: session.upId,
  });

  const passwordAdded = !!userWithPassword?.password?.hash;
  const identityProviderEmail = account?.providerEmail || "";
  const teamsWithWritePermission = permissionCheckResult;
  const canUpdateTeams = teamsWithWritePermission.length > 0;

  const userMetadataParsed = userMetadata.parse(user.metadata);

  // Build profile data
  const profileData = user.organization?.isPlatform
    ? {
        organizationId: null,
        organization: { id: -1, isPlatform: true, slug: "", isOrgAdmin: false },
        username: user.username ?? null,
        profile: ProfileRepository.buildPersonalProfileFromUser({ user }),
        profiles: [],
      }
    : {
        organizationId: user.profile?.organizationId ?? null,
        organization: user.organization,
        username: user.profile?.username ?? user.username ?? null,
        profile: user.profile ?? null,
        profiles: allUserEnrichedProfiles,
        organizationSettings: user?.profile?.organization?.organizationSettings,
      };

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailMd5: crypto.createHash("md5").update(user.email).digest("hex"),
    emailVerified: user.emailVerified,
    senderEmail: user.senderEmail,
    senderEmailVerified: user.senderEmailVerified,
    bufferTime: user.bufferTime,
    locale: user.locale,
    timeFormat: user.timeFormat,
    timeZone: user.timeZone,
    avatar: getUserAvatarUrl(user),
    avatarUrl: user.avatarUrl,
    createdDate: user.createdDate,
    trialEndsAt: user.trialEndsAt,
    defaultScheduleId: user.defaultScheduleId,
    completedOnboarding: user.completedOnboarding,
    twoFactorEnabled: user.twoFactorEnabled,
    disableImpersonation: user.disableImpersonation,
    identityProvider: user.identityProvider,
    identityProviderEmail,
    brandColor: user.brandColor,
    darkBrandColor: user.darkBrandColor,
    bio: user.bio,
    weekStart: user.weekStart,
    theme: user.theme,
    appTheme: user.appTheme,
    hideBranding: user.hideBranding,
    metadata: user.metadata,
    defaultBookerLayouts: user.defaultBookerLayouts,
    allowDynamicBooking: user.allowDynamicBooking,
    allowSEOIndexing: user.allowSEOIndexing,
    receiveMonthlyDigestEmail: user.receiveMonthlyDigestEmail,
    requiresBookerEmailVerification: user.requiresBookerEmailVerification,
    ...profileData,
    secondaryEmails,
    isPremium: userMetadataParsed?.isPremium,
    ...(passwordAdded ? { passwordAdded } : {}),
    canUpdateTeams,
  };
};
