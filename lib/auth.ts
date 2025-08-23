import { supabase } from './supabase'
import bcrypt from 'bcryptjs'

// Auth utilities with security measures
export class AuthService {
  private static readonly SESSION_KEY = 'rei_admin_session'
  private static readonly MAX_LOGIN_ATTEMPTS = 5
  private static readonly LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes

  // Hash password securely
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12
    return await bcrypt.hash(password, saltRounds)
  }

  // Verify password against hash
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash)
  }

  // Sanitize input to prevent injection
  private static sanitizeInput(input: string): string {
    return input.trim().replace(/[<>'"]/g, '')
  }

  // Generate secure session token
  private static generateSessionToken(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  // Check rate limiting
  private static checkRateLimit(username: string): boolean {
    const attempts = localStorage.getItem(`login_attempts_${username}`)
    const lastAttempt = localStorage.getItem(`last_attempt_${username}`)
    
    if (attempts && lastAttempt) {
      const attemptCount = parseInt(attempts)
      const lastAttemptTime = parseInt(lastAttempt)
      
      if (attemptCount >= this.MAX_LOGIN_ATTEMPTS) {
        const timeSinceLastAttempt = Date.now() - lastAttemptTime
        if (timeSinceLastAttempt < this.LOCKOUT_DURATION) {
          return false // Still locked out
        } else {
          // Reset attempts after lockout period
          localStorage.removeItem(`login_attempts_${username}`)
          localStorage.removeItem(`last_attempt_${username}`)
        }
      }
    }
    
    return true
  }

  // Record failed login attempt
  private static recordFailedAttempt(username: string): void {
    const attempts = localStorage.getItem(`login_attempts_${username}`)
    const currentAttempts = attempts ? parseInt(attempts) + 1 : 1
    
    localStorage.setItem(`login_attempts_${username}`, currentAttempts.toString())
    localStorage.setItem(`last_attempt_${username}`, Date.now().toString())
  }

  // Clear failed attempts on successful login
  private static clearFailedAttempts(username: string): void {
    localStorage.removeItem(`login_attempts_${username}`)
    localStorage.removeItem(`last_attempt_${username}`)
  }

  // Login with security measures
  static async login(username: string, password: string): Promise<{ success: boolean; message: string; user?: any }> {
    try {
      // Clear any existing rate limiting for debugging
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('login_attempts_') || key.startsWith('last_attempt_')) {
          localStorage.removeItem(key)
        }
      })
      
      // Sanitize inputs
      const cleanUsername = this.sanitizeInput(username)
      const cleanPassword = password // Don't sanitize password as it might contain special chars

      // Validate inputs
      if (!cleanUsername || !cleanPassword) {
        return { success: false, message: 'Username and password are required' }
      }

      if (cleanUsername.length < 3 || cleanPassword.length < 6) {
        return { success: false, message: 'Invalid credentials format' }
      }

      // Check rate limiting - DISABLED FOR DEBUGGING
      // if (!this.checkRateLimit(cleanUsername)) {
      //   return { 
      //     success: false, 
      //     message: `Too many failed attempts. Please try again in ${Math.ceil(this.LOCKOUT_DURATION / 60000)} minutes.` 
      //   }
      // }

      // Query database with parameterized query (Supabase handles SQL injection prevention)
      console.log('Attempting to query user_admin table...')
      
      const { data, error } = await supabase
        .from('user_admin')
        .select('*')
        .eq('username', cleanUsername)
        .maybeSingle() // Use maybeSingle instead of single to avoid error when no rows

      console.log('Supabase query result:', { data, error })

      if (error) {
        console.log('Supabase error details:', error)
        // Check if it's an RLS issue
        if (error.code === 'PGRST116' || error.message?.includes('0 rows')) {
          console.log('No user found with username:', cleanUsername)
          return { success: false, message: 'Invalid credentials' }
        }
        // Check if it's an RLS/permission issue
        if (error.message?.includes('permission') || error.message?.includes('policy')) {
          console.log('Permission/RLS issue detected')
          return { success: false, message: 'Database access issue. Please check RLS policies.' }
        }
        return { success: false, message: 'Database connection error' }
      }

      if (!data) {
        console.log('No user data returned')
        return { success: false, message: 'Invalid credentials' }
      }

      // Check password - handle both plain text and hashed passwords
      let isPasswordValid = false
      
      // Debug logging
      console.log('Login attempt for username:', cleanUsername)
      console.log('Password from DB starts with:', data.password.substring(0, 10))
      console.log('Password length:', data.password.length)
      
      // Check if password in database is already hashed (starts with $2a$, $2b$, or $2y$)
      if (data.password.startsWith('$2a$') || data.password.startsWith('$2b$') || data.password.startsWith('$2y$')) {
        // Password is hashed, use bcrypt compare
        console.log('Using bcrypt comparison')
        isPasswordValid = await this.verifyPassword(cleanPassword, data.password)
        console.log('Bcrypt comparison result:', isPasswordValid)
      } else {
        // Password is plain text, do direct comparison (for migration period)
        console.log('Using plain text comparison')
        isPasswordValid = cleanPassword === data.password
        
        // Optional: Hash the password and update database
        if (isPasswordValid) {
          console.log('Password matched (plain text). Consider updating to hashed version.')
          // Uncomment below to auto-update to hashed password
          // const hashedPassword = await this.hashPassword(cleanPassword)
          // await supabase.from('user_admin').update({ password: hashedPassword }).eq('id', data.id)
        }
      }
      
      if (!isPasswordValid) {
        // this.recordFailedAttempt(cleanUsername) // DISABLED FOR DEBUGGING
        console.log('Password validation failed')
        return { success: false, message: 'Invalid credentials' }
      }

      // Successful login
      this.clearFailedAttempts(cleanUsername)
      
      // Generate secure session
      const sessionToken = this.generateSessionToken()
      const sessionData = {
        token: sessionToken,
        userId: data.id,
        username: data.username,
        loginTime: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      }

      // Store session securely
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData))

      return { 
        success: true, 
        message: 'Login successful',
        user: { id: data.id, username: data.username }
      }

    } catch (error) {
      console.error('Login error:', error)
      return { success: false, message: 'An error occurred during login' }
    }
  }

  // Check if user is authenticated
  static isAuthenticated(): boolean {
    try {
      const sessionData = localStorage.getItem(this.SESSION_KEY)
      if (!sessionData) return false

      const session = JSON.parse(sessionData)
      
      // Check if session is expired
      if (Date.now() > session.expiresAt) {
        this.logout()
        return false
      }

      return true
    } catch (error) {
      console.error('Auth check error:', error)
      this.logout()
      return false
    }
  }

  // Get current user
  static getCurrentUser(): { id: number; username: string } | null {
    try {
      const sessionData = localStorage.getItem(this.SESSION_KEY)
      if (!sessionData) return null

      const session = JSON.parse(sessionData)
      
      if (Date.now() > session.expiresAt) {
        this.logout()
        return null
      }

      return { id: session.userId, username: session.username }
    } catch (error) {
      console.error('Get user error:', error)
      return null
    }
  }

  // Logout
  static logout(): void {
    localStorage.removeItem(this.SESSION_KEY)
    // Clear any other session data
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('login_attempts_') || key.startsWith('last_attempt_')) {
        localStorage.removeItem(key)
      }
    })
  }

  // Extend session
  static extendSession(): void {
    try {
      const sessionData = localStorage.getItem(this.SESSION_KEY)
      if (!sessionData) return

      const session = JSON.parse(sessionData)
      session.expiresAt = Date.now() + (24 * 60 * 60 * 1000) // Extend by 24 hours
      
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session))
    } catch (error) {
      console.error('Session extension error:', error)
    }
  }
}
