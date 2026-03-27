import prisma from "@calcom/prisma";
import type { WorkflowType } from "@calcom/prisma/client";

import type { Workflow } from "./types";

export const workflowSelect = {
  id: true,
  trigger: true,
  time: true,
  timeUnit: true,
  userId: true,
  teamId: true,
  name: true,
  steps: {
    select: {
      id: true,
      action: true,
      sendTo: true,
      reminderBody: true,
      emailSubject: true,
      template: true,
      numberVerificationPending: true,
      sender: true,
      includeCalendarEvent: true,
      numberRequired: true,
      verifiedAt: true,
      autoTranslateEnabled: true,
      sourceLocale: true,
    },
  },
};

export const getAllWorkflows = async ({
  entityWorkflows,
  userId,
  teamId,
  orgId,
  workflowsLockedForUser = true,
  type,
}: {
  entityWorkflows: Workflow[];
  userId?: number | null;
  teamId?: number | null;
  orgId?: number | null;
  workflowsLockedForUser?: boolean;
  type: WorkflowType;
}) => {
  const allWorkflows = [...entityWorkflows];

  // Execute all workflow queries in parallel for better performance
  const workflowQueries: Promise<any[]>[] = [];

  if (orgId) {
    if (teamId) {
      workflowQueries.push(
        prisma.workflowsOnTeams.findMany({
          where: {
            teamId: teamId,
            workflow: { type },
          },
          select: {
            workflow: { select: workflowSelect },
          },
        }).then(relations => relations.map(r => r.workflow))
      );
    } else if (userId) {
      workflowQueries.push(
        prisma.workflowsOnTeams.findMany({
          where: {
            workflow: { type },
            team: {
              members: {
                some: { userId, accepted: true },
              },
            },
          },
          select: {
            workflow: { select: workflowSelect },
            team: true,
          },
        }).then(relations => relations.map(r => r.workflow))
      );
    }
    
    workflowQueries.push(
      prisma.workflow.findMany({
        where: {
          teamId: orgId,
          isActiveOnAll: true,
          type,
        },
        select: workflowSelect,
      })
    );
  }

  if (teamId) {
    workflowQueries.push(
      prisma.workflow.findMany({
        where: { teamId, isActiveOnAll: true, type },
        select: workflowSelect,
      })
    );
  }

  if ((!teamId || !workflowsLockedForUser) && userId) {
    workflowQueries.push(
      prisma.workflow.findMany({
        where: {
          userId,
          teamId: null,
          isActiveOnAll: true,
          type,
        },
        select: workflowSelect,
      })
    );
  }

  // Execute all queries in parallel
  if (workflowQueries.length > 0) {
    const results = await Promise.all(workflowQueries);
    results.forEach(workflows => allWorkflows.push(...workflows));
  }

  // Remove duplicates efficiently
  const seen = new Set();
  const uniqueWorkflows = allWorkflows.filter((workflow) => {
    if (seen.has(workflow.id)) return false;
    seen.add(workflow.id);
    return true;
  });

  return uniqueWorkflows;
};
