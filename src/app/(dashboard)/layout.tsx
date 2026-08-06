import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Providers } from "@/components/providers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { subscription: true },
  });

  if (!user) redirect("/login");

  return (
    <Providers>
      <DashboardShell
        userName={user.name}
        tokenBalance={user.tokenBalance}
        plan={user.subscription?.plan ?? "FREE"}
      >
        {children}
      </DashboardShell>
    </Providers>
  );
}
