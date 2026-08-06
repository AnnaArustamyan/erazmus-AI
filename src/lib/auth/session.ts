import { auth } from "@/lib/auth";

export async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user;
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
