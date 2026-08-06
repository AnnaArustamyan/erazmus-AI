import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChatInterface } from "@/components/chat/chat-interface";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { chatId } = await params;

  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId: session.user.id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!chat) redirect("/chat");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { tokenBalance: true },
  });

  return (
    <ChatInterface
      chatId={chat.id}
      initialMessages={chat.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      }))}
      tokenBalance={user?.tokenBalance ?? 0}
    />
  );
}
