import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const protectedPrefixes = [
    "/dashboard",
    "/chat",
    "/projects",
    "/agents",
    "/billing",
    "/settings",
    "/admin",
  ];

  const isProtected = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/chat/:path*",
    "/projects/:path*",
    "/agents/:path*",
    "/billing/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/login",
    "/register",
  ],
};
