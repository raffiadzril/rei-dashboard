"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { AuthService } from "@/lib/auth"

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const checkAuth = () => {
      // Don't check auth for login page
      if (pathname === '/login') {
        setIsAuthenticated(true)
        setIsLoading(false)
        return
      }

      const authenticated = AuthService.isAuthenticated()
      setIsAuthenticated(authenticated)
      setIsLoading(false)

      if (!authenticated) {
        // Redirect to login with return URL
        const returnUrl = encodeURIComponent(pathname)
        router.push(`/login?returnUrl=${returnUrl}`)
      } else {
        // Extend session on activity
        AuthService.extendSession()
      }
    }

    checkAuth()

    // Check auth on page visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkAuth()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Periodic auth check (every 5 minutes)
    const authCheckInterval = setInterval(checkAuth, 5 * 60 * 1000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(authCheckInterval)
    }
  }, [pathname, router])

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600">Verifying authentication...</p>
        </div>
      </div>
    )
  }

  // Don't render children if not authenticated (except for login page)
  if (!isAuthenticated && pathname !== '/login') {
    return null
  }

  return <>{children}</>
}

// HOC version for page components
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AuthenticatedComponent(props: P) {
    return (
      <AuthGuard>
        <Component {...props} />
      </AuthGuard>
    )
  }
}
