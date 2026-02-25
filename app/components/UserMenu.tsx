"use client"

import { signOut, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { ChevronDown, LogOut, Settings } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export default function UserMenu() {
  const { data: session } = useSession()
  const router = useRouter()

  if (!session?.user) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-[var(--text-muted)] hover:text-[var(--foreground)]">
          {session.user.image && (
            <img
              src={session.user.image}
              alt={session.user.name || "User"}
              className="w-6 h-6 rounded-full"
            />
          )}
          <span className="hidden sm:inline">{session.user.name}</span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium truncate">{session.user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push("/settings")}
          className="cursor-pointer"
        >
          <Settings className="w-4 h-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-[var(--accent-red)] focus:text-[var(--accent-red)] cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
