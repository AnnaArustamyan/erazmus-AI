import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      const user = await prisma.user.findUnique({
        where: { email: credentials.email as string },
      });

      if (!user?.passwordHash || user.disabled) return null;

      const valid = await bcrypt.compare(
        credentials.password as string,
        user.passwordHash,
      );

      if (!valid) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.unshift(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
    newUser: "/register",
  },
  providers,
  events: {
    async createUser({ user }) {
      if (user.id) {
        const { allocateInitialTokens } = await import("@/lib/tokens/ledger");
        await allocateInitialTokens(user.id);
      }
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          include: { subscription: true },
        });
        token.id = user.id;
        token.role = dbUser?.role ?? "USER";
        token.plan = dbUser?.subscription?.plan ?? "FREE";
        token.tokenBalance = dbUser?.tokenBalance ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.plan = token.plan as string;
        session.user.tokenBalance = token.tokenBalance as number;
      }
      return session;
    },
  },
});
