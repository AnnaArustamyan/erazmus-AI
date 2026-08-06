import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await requireSessionUser();

    const chats = await prisma.chat.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        createdAt: true,
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json({ chats });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title : "New Chat";

    const chat = await prisma.chat.create({
      data: {
        userId: user.id,
        title,
      },
    });

    return NextResponse.json({ chat }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
