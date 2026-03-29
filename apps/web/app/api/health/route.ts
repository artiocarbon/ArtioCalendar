import { NextResponse } from "next/server";
import prisma from "@calcom/prisma";

export async function GET() {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "UP", database: "UP" });
  } catch (error) {
    console.error("Healthcheck failed:", error);
    return NextResponse.json(
      { status: "DOWN", database: "DOWN", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 503 }
    );
  }
}

export const dynamic = "force-dynamic";
