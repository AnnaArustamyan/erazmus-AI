import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth/session";
import { PLAN_LABELS } from "@/lib/tokens/plans";

export async function GET() {
  try {
    const sessionUser = await requireSessionUser();

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: {
        subscription: true,
        _count: {
          select: {
            projects: true,
            chats: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const recentProjects = await prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
      },
    });

    const recentChats = await prisma.chat.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        updatedAt: true,
      },
    });

    const usageLast30Days = await prisma.aiRequest.groupBy({
      by: ["createdAt"],
      where: {
        userId: user.id,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      _sum: { totalTokens: true },
    });

    const totalTokensUsed = await prisma.aiRequest.aggregate({
      where: { userId: user.id },
      _sum: { totalTokens: true },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tokenBalance: user.tokenBalance,
        plan: user.subscription?.plan ?? "FREE",
        planLabel: PLAN_LABELS[user.subscription?.plan ?? "FREE"],
      },
      stats: {
        projectCount: user._count.projects,
        chatCount: user._count.chats,
        totalTokensUsed: totalTokensUsed._sum.totalTokens ?? 0,
      },
      recentProjects,
      recentChats,
      usageLast30Days,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[user/me]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
