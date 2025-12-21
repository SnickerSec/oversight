"use client"

import { signOut, useSession } from "next-auth/react"
import { useState, useRef, useEffect } from "react"

export default function UserMenu() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (!session?.user) {
    return null
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-border)] transition-colors"
      >
        {session.user.image && (
          <img
            src={session.user.image}
            alt={session.user.name || "User"}
            className="w-6 h-6 rounded-full"
          />
        )}
        <span className="hidden sm:inline">{session.user.name}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--card-border)]">
            <p className="text-sm font-medium truncate">{session.user.name}</p>
            <p className="text-xs text-[var(--text-muted)] truncate">{session.user.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full px-4 py-2.5 text-left text-sm text-[var(--accent-red)] hover:bg-[var(--card-border)] transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
