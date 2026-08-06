import Link from "next/link";
import {
  MessageSquare,
  FolderKanban,
  Bot,
  ArrowRight,
  Zap,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatTokenCount } from "@/lib/utils";
import { PLAN_LABELS } from "@/lib/tokens/plans";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      subscription: true,
      _count: { select: { projects: true, chats: true } },
    },
  });

  if (!user) redirect("/login");

  const recentChats = await prisma.chat.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  const totalTokensUsed = await prisma.aiRequest.aggregate({
    where: { userId: user.id },
    _sum: { totalTokens: true },
  });

  const plan = user.subscription?.plan ?? "FREE";

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">
            Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Your Erasmus+ AI workspace
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4 text-accent" />
              Token balance
            </div>
            <p className="mt-2 text-3xl font-bold">
              {formatTokenCount(user.tokenBalance)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {PLAN_LABELS[plan]} plan
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              Conversations
            </div>
            <p className="mt-2 text-3xl font-bold">{user._count.chats}</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bot className="h-4 w-4" />
              Tokens used
            </div>
            <p className="mt-2 text-3xl font-bold">
              {formatTokenCount(totalTokensUsed._sum.totalTokens ?? 0)}
            </p>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">Quick actions</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link
              href="/chat"
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted"
            >
              <MessageSquare className="h-5 w-5 text-accent" />
              <div>
                <p className="font-medium">New chat</p>
                <p className="text-xs text-muted-foreground">
                  Ask about Erasmus+
                </p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </Link>

            <div className="flex items-center gap-3 rounded-xl border border-border bg-card/50 p-4 opacity-50">
              <FolderKanban className="h-5 w-5" />
              <div>
                <p className="font-medium">New project</p>
                <p className="text-xs text-muted-foreground">Phase 2</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border bg-card/50 p-4 opacity-50">
              <Bot className="h-5 w-5" />
              <div>
                <p className="font-medium">Run agent</p>
                <p className="text-xs text-muted-foreground">Phase 2</p>
              </div>
            </div>
          </div>
        </div>

        {recentChats.length > 0 && (
          <div>
            <h2 className="mb-4 text-lg font-semibold">Recent chats</h2>
            <div className="space-y-2">
              {recentChats.map((chat) => (
                <Link
                  key={chat.id}
                  href={`/chat/${chat.id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted"
                >
                  <span className="text-sm font-medium">{chat.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(chat.updatedAt).toLocaleDateString()}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
