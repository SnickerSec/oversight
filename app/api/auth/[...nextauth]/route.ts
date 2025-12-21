import NextAuth from "next-auth"
import GithubProvider from "next-auth/providers/github"

const ALLOWED_USERS = ["SnickerSec"]

const handler = NextAuth({
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_OAUTH_ID!,
      clientSecret: process.env.GITHUB_OAUTH_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      // Only allow specific GitHub users
      const githubProfile = profile as { login?: string }
      if (githubProfile?.login && ALLOWED_USERS.includes(githubProfile.login)) {
        return true
      }
      return false
    },
    async session({ session, token }) {
      // Add username to session
      if (session.user) {
        session.user.name = token.name
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
})

export { handler as GET, handler as POST }
