import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Public paths that don't require authentication
  const publicPaths = ['/login']
  
  const { pathname } = request.nextUrl
  
  // Allow public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }
  
  // Check for session token in cookies or headers
  const sessionCookie = request.cookies.get('rei_admin_session')
  const authHeader = request.headers.get('authorization')
  
  // For client-side routing, we'll let the component handle auth check
  // This middleware is more for API routes protection
  if (pathname.startsWith('/api/')) {
    if (!sessionCookie && !authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
