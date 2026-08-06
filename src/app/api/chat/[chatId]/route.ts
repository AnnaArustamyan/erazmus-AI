import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  try {
    const user = await requireSessionUser();
    const { chatId } = await params;

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: user.id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json({ chat });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  try {
    const user = await requireSessionUser();
    const { chatId } = await params;

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: user.id },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    await prisma.chat.delete({ where: { id: chatId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  try {
    const user = await requireSessionUser();
    const { chatId } = await params;
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : null;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: user.id },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const updated = await prisma.chat.update({
      where: { id: chatId },
      data: { title },
    });

    return NextResponse.json({ chat: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
