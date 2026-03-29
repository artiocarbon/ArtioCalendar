import { orderBy } from "lodash";

import { getBookerBaseUrlSync } from "@calcom/features/ee/organizations/lib/getBookerBaseUrlSync";
import { getBookerBaseUrl } from "@calcom/features/ee/organizations/lib/getBookerUrlServer";
import { EventTypeRepository } from "@calcom/features/eventtypes/repositories/eventTypeRepository";
import { hasFilter } from "@calcom/features/filters/lib/hasFilter";
import { MembershipRepository } from "@calcom/features/membership/repositories/MembershipRepository";
import { PermissionCheckService } from "@calcom/features/pbac/services/permission-check.service";
import { ProfileRepository } from "@calcom/features/profile/repositories/ProfileRepository";
import { UserRepository } from "@calcom/features/users/repositories/UserRepository";
import { getPlaceholderAvatar } from "@calcom/lib/defaultAvatarImage";
import { ErrorCode } from "@calcom/lib/errorCodes";
import { ErrorWithCode } from "@calcom/lib/errors";
import { getUserAvatarUrl } from "@calcom/lib/getAvatarUrl";
import logger from "@calcom/lib/logger";
import { markdownToSafeHTML } from "@calcom/lib/markdownToSafeHTML";
import { safeStringify } from "@calcom/lib/safeStringify";
import prisma from "@calcom/prisma";
import { MembershipRole, SchedulingType } from "@calcom/prisma/enums";
import { teamMetadataSchema } from "@calcom/prisma/zod-utils";
import { eventTypeMetaDataSchemaWithUntypedApps } from "@calcom/prisma/zod-utils";

const log = logger.getSubLogger({ prefix: ["viewer.eventTypes.getByViewerOptimized"] });

type User = {
  id: number;
  profile: {
    upId: string;
  };
};

type Filters = {
  teamIds?: number[];
  upIds?: string[];
  schedulingTypes?: SchedulingType[];
};

export type EventTypesByViewer = Awaited<ReturnType<typeof getEventTypesByViewerOptimized>>;

export const getEventTypesByViewerOptimized = async (user: User, filters?: Filters, forRoutingForms?: boolean) => {
  const userProfile = user.profile;
  
  // Combine initial queries into parallel operations
  const [
    profile,
    permissionResults,
    profileMemberships,
    profileEventTypes
  ] = await Promise.all([
    // Profile lookup
    ProfileRepository.findByUpIdWithAuth(userProfile.upId, user.id),
    
    // Combined permission checks
    new PermissionCheckService().getTeamIdsWithPermissions({
      userId: user.id,
      permissions: [
        { permission: "eventType.read", fallbackRoles: [MembershipRole.MEMBER, MembershipRole.ADMIN, MembershipRole.OWNER] },
        { permission: "eventType.update", fallbackRoles: [MembershipRole.ADMIN, MembershipRole.OWNER] }
      ]
    }),
    
    // Profile memberships with teams and event types
    MembershipRepository.findAllByUpIdIncludeTeamWithMembersAndEventTypes(
      { upId: userProfile.upId },
      { where: { accepted: true } }
    ),
    
    // Profile event types (conditional)
    (!filters || filters.upIds?.includes(userProfile.upId))
      ? new EventTypeRepository(prisma).findAllByUpId(
          { upId: userProfile.upId, userId: user.id },
          {
            where: { teamId: null },
            orderBy: [{ position: "desc" }, { id: "asc" }],
          }
        )
      : []
  ]);

  if (!profile) {
    throw new ErrorWithCode(ErrorCode.InternalServerError, "Profile not found");
  }

  const parentOrgHasLockedEventTypes = profile?.organization?.organizationSettings?.lockEventTypeCreationForUsers;
  const isFilterSet = filters && hasFilter(filters);
  const isUpIdInFilter = filters?.upIds?.includes(userProfile.upId);
  let shouldListUserEvents = !isFilterSet || isUpIdInFilter;

  if (isFilterSet && filters?.upIds && !isUpIdInFilter) {
    shouldListUserEvents = true;
  }

  // Extract permission results
  const teamsWithEventTypeReadPermission = permissionResults.get("eventType.read") || [];
  const teamsWithEventTypeUpdatePermission = permissionResults.get("eventType.update") || [];

  const memberships = profileMemberships.map((membership) => ({
    ...membership,
    team: {
      ...membership.team,
      metadata: teamMetadataSchema.parse(membership.team.metadata),
    },
  }));

  log.debug(safeStringify({ profileMemberships, profileEventTypes }));

  // Collect all unique user IDs from all event types and teams
  const allUserIds = new Set<number>();
  
  // Add users from profile event types
  profileEventTypes.forEach(eventType => {
    const eventTypeUsers = eventType?.hosts?.length 
      ? eventType.hosts.map(host => host.user.id)
      : eventType.users.map(u => u.id);
    eventTypeUsers.forEach(id => allUserIds.add(id));
    
    // Add child event users
    if (eventType.children) {
      eventType.children.forEach(child => {
        child.users.forEach(u => allUserIds.add(u.id));
      });
    }
  });
  
  // Add users from team event types
  memberships.forEach(membership => {
    membership.team.eventTypes.forEach(eventType => {
      const eventTypeUsers = eventType?.hosts?.length 
        ? eventType.hosts.map(host => host.user.id)
        : eventType.users.map(u => u.id);
      eventTypeUsers.forEach(id => allUserIds.add(id));
      
      // Add child event users
      if (eventType.children) {
        eventType.children.forEach(child => {
          child.users.forEach(u => allUserIds.add(u.id));
        });
      }
    });
  });

  // Batch enrich all users at once
  const userRepo = new UserRepository(prisma);
  const enrichedUsersMap = new Map(
    (await userRepo.enrichUsersWithTheirProfiles(Array.from(allUserIds)))
      .map(user => [user.id, user])
  );

  // Optimized mapEventType function using pre-enriched users
  const mapEventType = async (eventType: any) => {
    const eventTypeUsers = eventType?.hosts?.length 
      ? eventType.hosts.map(host => host.user)
      : eventType.users;
    const enrichedUsers = eventTypeUsers.map(user => enrichedUsersMap.get(user.id)).filter(Boolean);

    const children = eventType.children || [];
    const enrichedChildren = children.map((c) => ({
      ...c,
      users: c.users.map((user: any) => enrichedUsersMap.get(user.id)).filter((user: any) => !!user),
    }));

    return {
      ...eventType,
      safeDescription: eventType?.description ? markdownToSafeHTML(eventType.description) : undefined,
      users: enrichedUsers,
      metadata: eventType.metadata ? eventTypeMetaDataSchemaWithUntypedApps.parse(eventType.metadata) : null,
      children: enrichedChildren,
    };
  };

  // Process all event types in parallel
  const [userEventTypes, teamEventTypes] = await Promise.all([
    Promise.all(profileEventTypes.map(mapEventType)),
    Promise.all(
      memberships.map(async membership => ({
        membership,
        eventTypes: await Promise.all(membership.team.eventTypes.map(mapEventType))
      }))
    )
  ]);

  // Filter user event types
  const filteredUserEventTypes = userEventTypes.filter((eventType) => {
    const isAChildEvent = eventType.parentId;
    if (!isAChildEvent) return true;
    
    const childEventAssignee = eventType.users[0];
    return childEventAssignee && childEventAssignee.id === user.id;
  });

  const unmanagedEventTypes = filteredUserEventTypes.filter(
    (evType) => evType.schedulingType !== SchedulingType.MANAGED
  );

  // Build event type groups
  let eventTypeGroups = [];

  if (shouldListUserEvents) {
    const bookerUrl = await getBookerBaseUrl(profile.organizationId ?? null);
    eventTypeGroups.push({
      teamId: null,
      bookerUrl,
      membershipRole: null,
      profile: {
        slug: profile.username,
        name: profile.name,
        image: getUserAvatarUrl({ avatarUrl: profile.avatarUrl }),
        eventTypesLockedByOrg: parentOrgHasLockedEventTypes,
      },
      eventTypes: orderBy(unmanagedEventTypes, ["position", "id"], ["desc", "asc"]),
      metadata: {
        membershipCount: 1,
        readOnly: false,
      },
    });
  }

  // Process team memberships
  const teamMemberships = profileMemberships.map((membership) => ({
    teamId: membership.team.id,
    membershipRole: membership.role,
  }));

  const filterByTeamIds = (eventType: any) => {
    if (!filters || !hasFilter(filters)) return true;
    return filters?.teamIds?.includes(eventType?.teamId || 0) ?? false;
  };

  const filterBySchedulingTypes = (evType: any) => {
    if (!filters || !hasFilter(filters) || !filters.schedulingTypes) return true;
    return evType.schedulingType && filters.schedulingTypes.includes(evType.schedulingType);
  };

  // Process teams in parallel
  const processedTeams = await Promise.all(
    memberships
      .filter((mmship) => {
        if (mmship.team.isOrganization) return false;
        if (!filters || !hasFilter(filters)) return true;
        return filters?.teamIds?.includes(mmship?.team?.id || 0) ?? false;
      })
      .map(async (membership) => {
        const orgMembership = teamMemberships.find(
          (teamM) => teamM.teamId === membership.team.parentId
        )?.membershipRole;

        const team = {
          ...membership.team,
          metadata: teamMetadataSchema.parse(membership.team.metadata),
        };

        let slug = forRoutingForms 
          ? `team/${team.slug}`
          : team.slug ? (!team.parentId ? `team/${team.slug}` : `${team.slug}`) : null;

        const teamEventTypes = teamEventTypes.find(t => t.membership.team.id === team.id)?.eventTypes || [];
        const teamParentMetadata = team.parent ? teamMetadataSchema.parse(team.parent.metadata) : null;

        return {
          teamId: team.id,
          parentId: team.parentId,
          bookerUrl: getBookerBaseUrlSync(team.parent?.slug ?? teamParentMetadata?.requestedSlug ?? null),
          membershipRole: orgMembership && compareMembership(orgMembership, membership.role)
            ? orgMembership : membership.role,
          profile: {
            image: team.parent
              ? getPlaceholderAvatar(team.parent.logoUrl, team.parent.name)
              : getPlaceholderAvatar(team.logoUrl, team.name),
            name: team.name,
            slug,
          },
          metadata: {
            membershipCount: team.members.length,
            readOnly: !teamsWithEventTypeReadPermission.includes(team.id),
          },
          eventTypes: teamEventTypes
            .filter(filterByTeamIds)
            .filter((evType) => evType.userId === null || evType.userId === user.id)
            .filter((evType) => 
              !teamsWithEventTypeUpdatePermission.includes(team.id)
                ? evType.schedulingType !== SchedulingType.MANAGED
                : true
            )
            .filter(filterBySchedulingTypes),
        };
      })
  );

  eventTypeGroups = ([] as any[]).concat(eventTypeGroups, processedTeams);

  const denormalizedPayload = {
    eventTypeGroups,
    profiles: eventTypeGroups.map((group) => ({
      ...group.profile,
      ...group.metadata,
      teamId: group.teamId,
      membershipRole: group.membershipRole,
    })),
  };

  return normalizePayload(denormalizedPayload);

  function normalizePayload(payload: typeof denormalizedPayload) {
    const allUsersAcrossAllEventTypes = new Map<number, any>();
    const eventTypeGroups = payload.eventTypeGroups.map((group) => {
      return {
        ...group,
        eventTypes: group.eventTypes.map((eventType) => {
          const { users, ...rest } = eventType;
          return {
            ...rest,
            userIds: users.map((user) => {
              allUsersAcrossAllEventTypes.set(user.id, user);
              return user.id;
            }),
          };
        }),
      };
    });

    return {
      ...payload,
      allUsersAcrossAllEventTypes,
      eventTypeGroups,
    };
  }
};

export function compareMembership(mship1: MembershipRole, mship2: MembershipRole) {
  const mshipToNumber = (mship: MembershipRole) =>
    Object.keys(MembershipRole).findIndex((mmship) => mmship === mship);
  return mshipToNumber(mship1) > mshipToNumber(mship2);
}
