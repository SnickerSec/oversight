import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { rateLimit } from "@/lib/rate-limit"

function applySecurityHeaders(response: NextResponse): void {
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://avatars.githubusercontent.com data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
  )
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  )
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("X-DNS-Prefetch-Control", "on")
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
  )
  response.headers.delete("X-Powered-By")
}

const rateLimitRules: { prefix: string; limit: number; windowSeconds: number }[] = [
  { prefix: "/api/security/scan", limit: 3, windowSeconds: 60 },
  { prefix: "/api/slack/test", limit: 3, windowSeconds: 60 },
  { prefix: "/api/debug", limit: 5, windowSeconds: 60 },
  { prefix: "/api/settings", limit: 10, windowSeconds: 60 },
  { prefix: "/api/github", limit: 10, windowSeconds: 30 },
  { prefix: "/api/", limit: 30, windowSeconds: 60 },
]

function getRateLimitRule(pathname: string) {
  return rateLimitRules.find((rule) => pathname.startsWith(rule.prefix))
}

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  })

  const isAuthPage = request.nextUrl.pathname.startsWith("/login")
  const isAuthApi = request.nextUrl.pathname.startsWith("/api/auth")

  // Allow auth API routes (still apply security headers)
  if (isAuthApi) {
    const response = NextResponse.next()
    applySecurityHeaders(response)
    return response
  }

  // Redirect to login if not authenticated
  if (!token && !isAuthPage) {
    const loginUrl = new URL("/login", request.url)
    const response = NextResponse.redirect(loginUrl)
    applySecurityHeaders(response)
    return response
  }

  // Redirect to home if authenticated and trying to access login
  if (token && isAuthPage) {
    const homeUrl = new URL("/", request.url)
    const response = NextResponse.redirect(homeUrl)
    applySecurityHeaders(response)
    return response
  }

  // Rate limiting for API routes
  const { pathname } = request.nextUrl
  const rule = getRateLimitRule(pathname)

  if (rule) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const key = `${ip}:${rule.prefix}`
    const result = rateLimit(key, { limit: rule.limit, windowSeconds: rule.windowSeconds })

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
      const response = NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      )
      response.headers.set("Retry-After", String(retryAfter))
      response.headers.set("X-RateLimit-Limit", String(result.limit))
      response.headers.set("X-RateLimit-Remaining", "0")
      response.headers.set("X-RateLimit-Reset", String(result.resetAt))
      applySecurityHeaders(response)
      return response
    }

    const response = NextResponse.next()
    response.headers.set("X-RateLimit-Limit", String(result.limit))
    response.headers.set("X-RateLimit-Remaining", String(result.remaining))
    response.headers.set("X-RateLimit-Reset", String(result.resetAt))
    applySecurityHeaders(response)
    return response
  }

  const response = NextResponse.next()
  applySecurityHeaders(response)
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
