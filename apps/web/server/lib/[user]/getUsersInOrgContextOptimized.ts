import { UserRepository } from "@calcom/features/users/repositories/UserRepository";
import { SINGLE_ORG_SLUG } from "@calcom/lib/constants";
import prisma from "@calcom/prisma";

export async function getUsersInOrgContextOptimized(usernameList: string[], orgSlug: string | null) {
  const userRepo = new UserRepository(prisma);

  // Optimized: Run all user lookups in parallel
  const [
    usersInOrgContext,
    platformMembers,
    personalUsers
  ] = await Promise.all([
    // Primary user lookup
    userRepo.findUsersByUsername({
      usernameList,
      orgSlug,
    }),
    
    // Platform members lookup (fallback)
    userRepo.findPlatformMembersByUsernames({
      usernameList,
    }),
    
    // Personal users lookup (conditional fallback)
    (orgSlug && SINGLE_ORG_SLUG)
      ? userRepo.findUsersByUsername({
          usernameList,
          orgSlug: null,
        })
      : Promise.resolve([]),
  ]);

  // Use first successful result
  return usersInOrgContext.length 
    ? usersInOrgContext 
    : platformMembers.length 
      ? platformMembers 
      : personalUsers;
}
