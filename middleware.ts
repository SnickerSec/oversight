export { default } from "next-auth/middleware"

export const config = {
  matcher: [
    // Protect all routes except login and auth API
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
}
