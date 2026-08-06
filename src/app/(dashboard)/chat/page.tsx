import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ChatIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const chat = await prisma.chat.create({
    data: {
      userId: session.user.id,
      title: "New Chat",
    },
  });

  redirect(`/chat/${chat.id}`);
}
