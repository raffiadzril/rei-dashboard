import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://jokvxdrxswytjjhxuhvk.supabase.co"
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impva3Z4ZHJ4c3d5dGpqaHh1aHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0MzMwMjIsImV4cCI6MjA2OTAwOTAyMn0.hKilH2syHkxQOnAQ8TlPB7sJOCDRihxzNqv-3MzXgPU"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface User {
  id: string
  name: string
  school?: string
  gender?: string
  age?: number
  class?: string
  role?: string
  profile_image_url?: string
  education_level?: string
  is_active_sports_member?: string
  sports_duration?: string
  sports_frequency?: string
  sports_liking?: string
  has_sports_competition?: string
  likes_sports_competition?: string
  created_at?: string
  updated_at?: string
}

export interface Challenge {
  id: string
  title: string
  description?: string
  image_url?: string
}

export interface Question {
  id: string
  challenge_id: string
  question_text: string
  question_number?: number
  image_url?: string
  challenge?: Challenge
}

export interface Option {
  id: string
  question_id: string
  option_label?: string
  option_text?: string
  image_url?: string
  score_option?: number
  question?: Question
}

export interface UserAnswer {
  id: string
  user_id: string
  question_id: string
  selected_option_id?: string
  answered_at?: string
  user?: User
  question?: Question
  selected_option?: Option
}

export interface REIAccumulate {
  id: number
  user_id?: string
  respect?: number
  equity?: number
  inclusion?: number
  all_category?: string
  all_note?: string
  respect_category?: string
  respect_note?: string
  equity_category?: string
  equity_note?: string
  inclussion_category?: string
  inclusion_note?: string
  label_anak_ramah_category?: string
  label_anak_ramah_category_respect?: string
  label_anak_ramah_category_equity?: string
  label_anak_ramah_category_inclusion?: string
  created_at: string
  user?: User
}

export interface UserAdmin {
  id: number
  username: string
  password: string
}
