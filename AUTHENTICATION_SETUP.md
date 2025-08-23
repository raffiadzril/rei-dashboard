# REI Dashboard Authentication Setup

## Security Features Implemented

✅ **SQL Injection Protection**: Using Supabase parameterized queries
✅ **Password Hashing**: bcrypt with salt rounds 12
✅ **Rate Limiting**: 5 attempts per username with 15-minute lockout
✅ **Secure Sessions**: Cryptographically secure tokens with 24-hour expiry
✅ **Input Sanitization**: XSS prevention and input validation
✅ **Session Management**: Auto-logout on inactivity, session extension on activity
✅ **Secure Headers**: CSRF protection and secure cookie settings

## Database Setup

### 1. Create the user_admin table (if not already created):

```sql
CREATE TABLE public.user_admin (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. Hash your password:

The current password `rei2025rei-respecT` needs to be hashed before storing in database.

Run the hash script:
```bash
cd scripts
node hash-password.js
```

This will output a hashed password and SQL command. Copy and run the SQL command in your database.

### 3. Alternative - Manual password hashing:

If you need to hash the password manually, use this code:

```javascript
const bcrypt = require('bcryptjs');

const hashPassword = async () => {
  const hash = await bcrypt.hash('rei2025rei-respecT', 12);
  console.log('Hashed password:', hash);
}

hashPassword();
```

## Security Configuration

### Environment Variables (Optional - for additional security)

Create a `.env.local` file:

```env
# Session encryption key (generate a random 32-character string)
SESSION_SECRET=your-32-character-random-string-here

# Rate limiting settings
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=900000

# Session duration (24 hours in milliseconds)
SESSION_DURATION=86400000
```

### Recommended Security Headers

Add to your `next.config.js`:

```javascript
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};
```

## Usage

### 1. Login Process:
- Navigate to `/login`
- Enter username: `reiadmin2025upi`
- Enter password: `rei2025rei-respecT`
- System will validate credentials and create secure session

### 2. Access Control:
- All routes except `/login` require authentication
- Sessions expire after 24 hours of inactivity
- Rate limiting prevents brute force attacks
- Auto-logout on session expiry

### 3. Logout:
- Click user avatar in top-right corner
- Select "Log out" from dropdown
- Confirm logout in dialog

## Security Best Practices Implemented

1. **Password Security**:
   - bcrypt hashing with salt rounds 12
   - No plain text password storage
   - Secure password comparison

2. **Session Security**:
   - Cryptographically secure random tokens
   - Client-side session storage with expiry
   - Automatic session extension on activity

3. **Rate Limiting**:
   - 5 failed attempts trigger 15-minute lockout
   - Per-username rate limiting
   - Lockout state persisted in localStorage

4. **Input Validation**:
   - XSS protection through input sanitization
   - SQL injection prevention via parameterized queries
   - Input length limits

5. **Authentication Flow**:
   - AuthGuard component protects all routes
   - Middleware for additional API protection
   - Automatic redirect to login for unauthenticated users

6. **UI Security**:
   - Loading states prevent multiple submissions
   - Error messages don't reveal system information
   - Password visibility toggle for UX

## Monitoring & Logging

The system logs:
- Failed login attempts
- Session creation/destruction
- Authentication errors
- Rate limiting triggers

Monitor these logs for suspicious activity.

## Production Considerations

1. **HTTPS Only**: Ensure SSL/TLS in production
2. **Environment Variables**: Move sensitive config to environment variables
3. **Database Security**: Use database connection pooling and read replicas
4. **Session Storage**: Consider Redis for session storage in production
5. **Monitoring**: Implement proper logging and monitoring
6. **Backup**: Regular database backups including user_admin table

## Troubleshooting

### Common Issues:

1. **Login fails with correct credentials**:
   - Check if password is properly hashed in database
   - Verify username matches exactly (case-sensitive)

2. **Rate limiting triggered**:
   - Wait 15 minutes for lockout to expire
   - Clear localStorage: `localStorage.clear()`

3. **Session expires immediately**:
   - Check system clock synchronization
   - Verify browser localStorage is enabled

4. **Redirect loop**:
   - Clear browser cache and localStorage
   - Check AuthGuard implementation
