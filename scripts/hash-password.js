// Script to hash the existing password in database
// Run this once to update the password in your database

import bcrypt from 'bcryptjs'

const hashPassword = async () => {
  const plainPassword = 'rei2025rei-respecT'
  const saltRounds = 12
  
  try {
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds)
    console.log('Original password:', plainPassword)
    console.log('Hashed password:', hashedPassword)
    console.log('\nRun this SQL to update your database:')
    console.log(`UPDATE user_admin SET password = '${hashedPassword}' WHERE id = 1;`)
  } catch (error) {
    console.error('Error hashing password:', error)
  }
}

hashPassword()

// To run this script:
// 1. Save this file as hash-password.js
// 2. Run: node hash-password.js
// 3. Copy the generated SQL command and run it in your database
