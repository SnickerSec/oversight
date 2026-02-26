"use client"

import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, Github } from "lucide-react"

function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center pb-2">
          <Github className="w-16 h-16 mx-auto text-[var(--foreground)] mb-4" />
          <h1 className="text-2xl font-bold">GitHub Oversight</h1>
          <p className="text-muted-foreground mt-2">Sign in to access your dashboard</p>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {error === "AccessDenied"
                  ? "Access denied. Only authorized users can sign in."
                  : "An error occurred during sign in."}
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={() => signIn("github", { callbackUrl: "/" })}
            className="w-full bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 py-3"
            size="lg"
          >
            <Github className="w-5 h-5" />
            Sign in with GitHub
          </Button>

          <p className="text-muted-foreground text-sm text-center">
            Only authorized GitHub accounts can access this dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
