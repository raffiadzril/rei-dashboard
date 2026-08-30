"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase, type Challenge, type Question, type Option, type User, type UserAnswer, type REIAccumulate } from "@/lib/supabase"
import { Download, FileSpreadsheet, Users, Target, Eye, EyeOff, Search, ChevronLeft, ChevronRight, Calendar, Activity, School, User as UserIcon, Trophy } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from 'xlsx-js-style'

interface UserResult {
  user_id: string
  user_name: string
  user_school: string
  user_gender: string
  user_age: number
  user_class: string
  user_role?: string
  education_level?: string
  is_active_sports_member?: string
  sports_duration?: string
  sports_frequency?: string
  sports_liking?: string
  has_sports_competition?: string
  likes_sports_competition?: string
  answered_at?: string
  challenge_id: string
  challenge_title: string
  answers: { [questionId: string]: { question_text: string; selected_option: string; score: number } }
  rei_data?: {
    respect: number
    equity: number
    inclusion: number
    all_category?: string
    respect_category: string
    equity_category: string
    inclusion_category: string
    label_anak_ramah_category: string
    label_anak_ramah_category_respect: string
    label_anak_ramah_category_equity: string
    label_anak_ramah_category_inclusion: string
  }
}

export default function ResultsPage() {
  const [results, setResults] = useState<UserResult[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [challengeQuestions, setChallengeQuestions] = useState<Question[]>([])
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  
  // View controls state
  const [showQuestions, setShowQuestions] = useState<boolean>(true)
  const [showSportsInfo, setShowSportsInfo] = useState<boolean>(true)
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [pageSize, setPageSize] = useState<number>(25)
  const [currentPage, setCurrentPage] = useState<number>(1)

  const { toast } = useToast()

  useEffect(() => {
    fetchChallenges()
  }, [])

  useEffect(() => {
    if (selectedChallengeId) {
      setCurrentPage(1)
      fetchResults()
    }
  }, [selectedChallengeId])

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—"
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    } catch {
      return dateStr
    }
  }

  const fetchChallenges = async () => {
    try {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .order("title", { ascending: true })

      if (error) {
        throw error
      }

      setChallenges(data || [])
      if (data && data.length > 0) {
        setSelectedChallengeId(data[0].id)
      }
    } catch (error) {
      console.error("Error fetching challenges:", error)
      toast({
        title: "Error",
        description: "Failed to fetch challenges",
        variant: "destructive",
      })
    }
  }

  const fetchResults = async () => {
    if (!selectedChallengeId) return

    setLoading(true)
    try {
      // Fetch all questions for the selected challenge
      const { data: questions, error: questionsError } = await supabase
        .from("questions")
        .select("*")
        .eq("challenge_id", selectedChallengeId)
        .order("question_number", { ascending: true })

      if (questionsError) throw questionsError
      setChallengeQuestions(questions || [])

      const questionIds = questions?.map(q => q.id) || []
      if (questionIds.length === 0) {
        setResults([])
        setLoading(false)
        return
      }

      // Fetch all user answers for this challenge using pagination (bypassing Supabase 1000 limit)
      let allUserAnswers: any[] = []
      let from = 0
      const chunkPageSize = 1000
      let hasMoreAnswers = true

      while (hasMoreAnswers) {
        const { data: chunk, error: answersError } = await supabase
          .from("user_answers")
          .select(`
            *,
            users (
              id,
              name,
              school,
              gender,
              age,
              class,
              role,
              education_level,
              is_active_sports_member,
              sports_duration,
              sports_frequency,
              sports_liking,
              has_sports_competition,
              likes_sports_competition
            ),
            questions (
              id,
              question_text,
              question_number,
              challenge_id
            ),
            options (
              id,
              option_text,
              score_option
            )
          `)
          .in("question_id", questionIds)
          .range(from, from + chunkPageSize - 1)

        if (answersError) throw answersError

        if (chunk && chunk.length > 0) {
          allUserAnswers = allUserAnswers.concat(chunk)
          if (chunk.length < chunkPageSize) {
            hasMoreAnswers = false
          } else {
            from += chunkPageSize
          }
        } else {
          hasMoreAnswers = false
        }
      }

      // Fetch REI data for all users in chunks of 500
      const uniqueUserIds = [...new Set(allUserAnswers.map(ua => ua.user_id).filter(Boolean))]
      let allReiData: any[] = []
      
      const reiChunkSize = 500
      for (let i = 0; i < uniqueUserIds.length; i += reiChunkSize) {
        const userBatch = uniqueUserIds.slice(i, i + reiChunkSize)
        const { data: reiChunk, error: reiError } = await supabase
          .from("rei_accumulate")
          .select("*")
          .in("user_id", userBatch)

        if (reiError) throw reiError
        if (reiChunk) {
          allReiData = allReiData.concat(reiChunk)
        }
      }

      // Process and group data by user
      const userResultsMap = new Map<string, UserResult>()

      allUserAnswers.forEach((answer: any) => {
        const userId = answer.user_id
        const user = answer.users
        const question = answer.questions
        const option = answer.options

        if (!userResultsMap.has(userId)) {
          const userReiData = allReiData.find(rei => rei.user_id === userId)

          userResultsMap.set(userId, {
            user_id: userId,
            user_name: user?.name || "Unknown",
            user_school: user?.school || "",
            user_gender: user?.gender || "",
            user_age: user?.age || 0,
            user_class: user?.class || "",
            user_role: user?.role || "murid",
            education_level: user?.education_level || "",
            is_active_sports_member: user?.is_active_sports_member || "",
            sports_duration: user?.sports_duration || "",
            sports_frequency: user?.sports_frequency || "",
            sports_liking: user?.sports_liking || "",
            has_sports_competition: user?.has_sports_competition || "",
            likes_sports_competition: user?.likes_sports_competition || "",
            answered_at: answer.answered_at || userReiData?.created_at || "",
            challenge_id: selectedChallengeId,
            challenge_title: challenges.find(c => c.id === selectedChallengeId)?.title || "",
            answers: {},
            rei_data: userReiData ? {
              respect: userReiData.respect || 0,
              equity: userReiData.equity || 0,
              inclusion: userReiData.inclusion || 0,
              respect_category: userReiData.respect_category || "",
              equity_category: userReiData.equity_category || "",
              inclusion_category: userReiData.inclussion_category || "",
              label_anak_ramah_category: userReiData.label_anak_ramah_category || "",
              label_anak_ramah_category_respect: userReiData.label_anak_ramah_category_respect || "",
              label_anak_ramah_category_equity: userReiData.label_anak_ramah_category_equity || "",
              label_anak_ramah_category_inclusion: userReiData.label_anak_ramah_category_inclusion || "",
            } : undefined
          })
        }

        const userResult = userResultsMap.get(userId)!
        
        // Track the latest answer date if available
        if (answer.answered_at && (!userResult.answered_at || new Date(answer.answered_at) > new Date(userResult.answered_at))) {
          userResult.answered_at = answer.answered_at
        }

        userResult.answers[question?.id] = {
          question_text: question?.question_text || "",
          selected_option: option?.option_text || "No answer",
          score: option?.score_option || 0
        }
      })

      // Automatic Fallback: If any user doesn't have rei_data or has empty values in rei_accumulate, compute it from their answers
      const is13 = selectedChallengeId === 'a1b2c3d4-e5f6-7890-abcd-131313131313' || questions.length === 45
      
      userResultsMap.forEach((userResult) => {
        const hasValidRei = userResult.rei_data && (userResult.rei_data.respect > 0 || userResult.rei_data.equity > 0 || userResult.rei_data.inclusion > 0)
        
        if (!hasValidRei) {
          let r_sum = 0, e_sum = 0, i_sum = 0
          let answeredCount = 0

          Object.entries(userResult.answers).forEach(([qId, ans]) => {
            const qObj = questions.find(q => q.id === qId)
            const qNum = qObj?.question_number || 0
            const score = ans.score || 0

            if (ans.selected_option && ans.selected_option !== "No answer" && ans.selected_option !== "—") {
              answeredCount++
              if (is13) {
                if (qNum >= 1 && qNum <= 15) r_sum += score
                else if (qNum >= 16 && qNum <= 30) e_sum += score
                else if (qNum >= 31 && qNum <= 45) i_sum += score
              } else {
                if (qNum >= 1 && qNum <= 5) r_sum += score
                else if (qNum >= 6 && qNum <= 10) e_sum += score
                else if (qNum >= 11 && qNum <= 15) i_sum += score
              }
            }
          })

          if (answeredCount > 0) {
            if (is13) {
              const r_avg = r_sum / 15.0
              const e_avg = e_sum / 15.0
              const i_avg = i_sum / 15.0
              const all_avg = (r_sum + e_sum + i_sum) / 45.0

              const getCat13 = (avg: number) => {
                if (avg >= 3.68) return 'Tinggi'
                if (avg >= 2.34) return 'Sedang'
                if (avg >= 1.00) return 'Rendah'
                return '—'
              }

              userResult.rei_data = {
                respect: r_sum,
                equity: e_sum,
                inclusion: i_sum,
                respect_category: getCat13(r_avg),
                equity_category: getCat13(e_avg),
                inclusion_category: getCat13(i_avg),
                all_category: getCat13(all_avg),
                label_anak_ramah_category: getCat13(all_avg),
                label_anak_ramah_category_respect: getCat13(r_avg),
                label_anak_ramah_category_equity: getCat13(e_avg),
                label_anak_ramah_category_inclusion: getCat13(i_avg),
              }
            } else {
              const total = r_sum + e_sum + i_sum
              const getCat712 = (val: number) => {
                if (val >= 13) return { cat: 'Sangat Baik', label: 'Kamu Hebat!' }
                if (val >= 10) return { cat: 'Baik', label: 'Kamu Sudah Bagus!' }
                if (val >= 7) return { cat: 'Cukup', label: 'Kamu Sedang Belajar!' }
                if (val >= 5) return { cat: 'Belum', label: 'Ayo Kita Latih Sama-Sama!' }
                return { cat: '—', label: '—' }
              }

              const getAllCat712 = (val: number) => {
                if (val >= 40) return { cat: 'Sangat Baik', label: 'Kamu Hebat!' }
                if (val >= 34) return { cat: 'Baik', label: 'Kamu Sudah Bagus!' }
                if (val >= 26) return { cat: 'Cukup', label: 'Kamu Sedang Belajar!' }
                if (val >= 15) return { cat: 'Belum', label: 'Ayo Kita Latih Sama-Sama!' }
                return { cat: '—', label: '—' }
              }

              const rInfo = getCat712(r_sum)
              const eInfo = getCat712(e_sum)
              const iInfo = getCat712(i_sum)
              const allInfo = getAllCat712(total)

              userResult.rei_data = {
                respect: r_sum,
                equity: e_sum,
                inclusion: i_sum,
                respect_category: rInfo.cat,
                equity_category: eInfo.cat,
                inclusion_category: iInfo.cat,
                all_category: allInfo.cat,
                label_anak_ramah_category: allInfo.label,
                label_anak_ramah_category_respect: rInfo.label,
                label_anak_ramah_category_equity: eInfo.label,
                label_anak_ramah_category_inclusion: iInfo.label,
              }
            }
          }
        }
      })

      setResults(Array.from(userResultsMap.values()))
    } catch (error) {
      console.error("Error fetching results:", error)
      toast({
        title: "Error",
        description: "Failed to fetch results",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getSortedQuestions = (results: UserResult[], currentQuestions: Question[] = challengeQuestions) => {
    const allQuestionsMap = new Map<string, { text: string; number: number }>()

    // First register all questions from the challenge
    currentQuestions.forEach((q, idx) => {
      let questionNumber = q.question_number || (idx + 1)
      const questionText = q.question_text || ""
      const numberMatch = questionText.match(/^(?:Question\s*)?(\d+)[\.\:\s]/)
      if (numberMatch) {
        questionNumber = parseInt(numberMatch[1], 10)
      }
      allQuestionsMap.set(q.id, {
        text: questionText,
        number: questionNumber
      })
    })

    // Also register from answers if any
    results.forEach(result => {
      Object.entries(result.answers).forEach(([questionId, answerData]) => {
        if (!allQuestionsMap.has(questionId)) {
          const questionText = answerData.question_text
          let questionNumber = allQuestionsMap.size + 1

          const numberMatch = questionText.match(/^(?:Question\s*)?(\d+)[\.\:\s]/)
          if (numberMatch) {
            questionNumber = parseInt(numberMatch[1], 10)
          }

          allQuestionsMap.set(questionId, {
            text: questionText,
            number: questionNumber
          })
        }
      })
    })

    // Sort questions by their number
    return Array.from(allQuestionsMap.entries()).sort((a, b) => {
      return a[1].number - b[1].number
    })
  }

  // Challenge type helpers
  const is13Plus = selectedChallengeId === 'a1b2c3d4-e5f6-7890-abcd-131313131313' || challengeQuestions.length === 45

  const formatReiScore = (score: number | undefined | null) => {
    if (score === undefined || score === null) return "—"
    if (is13Plus) {
      // 15 questions per category -> Mean score (1.00 - 5.00)
      const avg = score > 5 ? score / 15 : score
      return avg.toFixed(2)
    }
    return score.toString()
  }

  const getMainCategory = (result: UserResult) => {
    if (is13Plus) {
      return result.rei_data?.all_category || result.rei_data?.label_anak_ramah_category || "—"
    }
    return result.rei_data?.label_anak_ramah_category || result.rei_data?.all_category || "—"
  }

  const getRespectCategory = (result: UserResult) => {
    if (is13Plus) {
      return result.rei_data?.respect_category || result.rei_data?.label_anak_ramah_category_respect || "—"
    }
    return result.rei_data?.label_anak_ramah_category_respect || result.rei_data?.respect_category || "—"
  }

  const getEquityCategory = (result: UserResult) => {
    if (is13Plus) {
      return result.rei_data?.equity_category || result.rei_data?.label_anak_ramah_category_equity || "—"
    }
    return result.rei_data?.label_anak_ramah_category_equity || result.rei_data?.equity_category || "—"
  }

  const getInclusionCategory = (result: UserResult) => {
    if (is13Plus) {
      return result.rei_data?.inclusion_category || result.rei_data?.label_anak_ramah_category_inclusion || "—"
    }
    return result.rei_data?.label_anak_ramah_category_inclusion || result.rei_data?.inclusion_category || "—"
  }

  const exportToExcel = async () => {
    if (results.length === 0) {
      toast({
        title: "No Data",
        description: "No data to export",
        variant: "destructive",
      })
      return
    }

    setExporting(true)
    try {
      // Get sorted questions using helper function
      const sortedQuestions = getSortedQuestions(results, challengeQuestions)
      const totalQuestions = sortedQuestions.length

      // Create headers with proper question text, user demographics, and sports profile
      const headers = [
        "No",
        "Tanggal / Waktu",
        "Nama Siswa",
        "ID Siswa",
        "Sekolah",
        "Jenjang Pendidikan",
        "Kelas",
        "Jenis Kelamin",
        "Usia",
        "Anggota Klub/Ekskul Olahraga",
        "Durasi Olahraga",
        "Frekuensi Olahraga",
        "Minat Olahraga",
        "Pernah Ikut Lomba",
        "Tertarik Ikut Lomba",
        "Challenge",
        ...sortedQuestions.map(([questionId, questionData]) => {
          const questionText = questionData.text || `Question ${questionData.number}`
          return questionText.length > 80 ? questionText.substring(0, 80) + "..." : questionText
        }),
        "Pernyataan Terisi (Answered / Total)",
        // REI Data headers
        is13Plus ? "REI - Respect (Mean)" : "REI - Respect Score",
        is13Plus ? "REI - Equity (Mean)" : "REI - Equity Score",
        is13Plus ? "REI - Inclusion (Mean)" : "REI - Inclusion Score",
        "REI - Respect Category",
        "REI - Equity Category",
        "REI - Inclusion Category",
        "REI - Main Category"
      ]

      // Create data rows with consistent order
      const data = results.map((result, idx) => {
        const answeredCount = sortedQuestions.filter(([questionId]) => {
          const ans = result.answers[questionId]
          if (!ans || !ans.selected_option) return false
          const trimmed = ans.selected_option.trim().toLowerCase()
          return trimmed !== "" && trimmed !== "no answer" && trimmed !== "—" && trimmed !== "-"
        }).length
        const answeredRatio = `${answeredCount}/${totalQuestions}`

        const row = [
          idx + 1,
          formatDate(result.answered_at),
          result.user_name || "—",
          result.user_id || "—",
          result.user_school || "—",
          result.education_level || "—",
          result.user_class || "—",
          result.user_gender || "—",
          result.user_age || "—",
          result.is_active_sports_member || "—",
          result.sports_duration || "—",
          result.sports_frequency || "—",
          result.sports_liking || "—",
          result.has_sports_competition || "—",
          result.likes_sports_competition || "—",
          result.challenge_title || "—",
          ...sortedQuestions.map(([questionId]) =>
            result.answers[questionId]?.selected_option || "No answer"
          ),
          answeredRatio,
          // REI Data
          result.rei_data?.respect !== undefined ? formatReiScore(result.rei_data?.respect) : "",
          result.rei_data?.equity !== undefined ? formatReiScore(result.rei_data?.equity) : "",
          result.rei_data?.inclusion !== undefined ? formatReiScore(result.rei_data?.inclusion) : "",
          getRespectCategory(result),
          getEquityCategory(result),
          getInclusionCategory(result),
          getMainCategory(result)
        ]
        return row
      })

      // Create workbook
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data])

      // Set generous column widths for better readability
      const colWidths = [
        { wch: 6 },  // No
        { wch: 18 }, // Tanggal / Waktu
        { wch: 22 }, // Nama Siswa
        { wch: 15 }, // ID Siswa
        { wch: 22 }, // Sekolah
        { wch: 18 }, // Jenjang Pendidikan
        { wch: 10 }, // Kelas
        { wch: 14 }, // Jenis Kelamin
        { wch: 8 },  // Usia
        { wch: 24 }, // Anggota Klub/Ekskul
        { wch: 18 }, // Durasi Olahraga
        { wch: 20 }, // Frekuensi Olahraga
        { wch: 18 }, // Minat Olahraga
        { wch: 20 }, // Pernah Ikut Lomba
        { wch: 20 }, // Tertarik Ikut Lomba
        { wch: 25 }, // Challenge
        ...sortedQuestions.map(() => ({ wch: 30 })), // Questions
        { wch: 20 }, // Pernyataan Terisi
        { wch: 16 }, // REI Respect
        { wch: 16 }, // REI Equity
        { wch: 16 }, // REI Inclusion
        { wch: 18 }, // REI Respect Category
        { wch: 18 }, // REI Equity Category
        { wch: 18 }, // REI Inclusion Category
        { wch: 20 }, // REI Main Category
      ]
      ws['!cols'] = colWidths

      // Apply Excel Cell Styling (Borders, Colors, Typography, Alignments)
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1')
      const numQuestions = sortedQuestions.length

      // Set Row Heights
      const rowsHeight: { hpt: number }[] = [{ hpt: 32 }] // Header height
      for (let r = range.s.r + 1; r <= range.e.r; r++) {
        rowsHeight.push({ hpt: 24 }) // Data row height
      }
      ws['!rows'] = rowsHeight

      // Border definitions
      const thinBorder = {
        top: { style: 'thin', color: { rgb: 'CBD5E1' } },
        bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
        left: { style: 'thin', color: { rgb: 'CBD5E1' } },
        right: { style: 'thin', color: { rgb: 'CBD5E1' } },
      }

      const headerBorder = {
        top: { style: 'medium', color: { rgb: '0F172A' } },
        bottom: { style: 'medium', color: { rgb: '0F172A' } },
        left: { style: 'thin', color: { rgb: '475569' } },
        right: { style: 'thin', color: { rgb: '475569' } },
      }

      // 1. Format Header Row (Row 0)
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_cell({ r: 0, c: C })
        if (!ws[address]) continue

        let headerColor = '1E3A8A' // Default Navy Blue (User Info)

        if (C >= 9 && C <= 14) {
          headerColor = '065F46' // Dark Emerald for Sports Profile (Cols 9-14)
        } else if (C === 15) {
          headerColor = '1E40AF' // Blue for Challenge
        } else if (C >= 16 && C < 16 + numQuestions) {
          headerColor = '0369A1' // Sky Blue for Question Columns
        } else if (C === 16 + numQuestions) {
          headerColor = '92400E' // Amber/Brown for Pernyataan Terisi
        } else if (C > 16 + numQuestions) {
          headerColor = '166534' // Forest Green for REI Scores & Categories
        }

        ws[address].s = {
          fill: { fgColor: { rgb: headerColor } },
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: headerBorder,
        }
      }

      // 2. Format Data Rows (Row 1 to End)
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        const isEven = R % 2 === 0
        const rowBgColor = isEven ? 'FFFFFF' : 'F8FAFC' // Alternating clean zebra rows

        for (let C = range.s.c; C <= range.e.c; ++C) {
          const address = XLSX.utils.encode_cell({ r: R, c: C })
          if (!ws[address]) continue

          const val = String(ws[address].v || '')
          let align: 'left' | 'center' | 'right' = 'center'
          let fontColor = '0F172A'
          let isBold = false
          let cellBg = rowBgColor

          // Column Alignments: Left align text-heavy columns
          if (C === 2 || C === 4 || C === 12 || C === 15 || (C >= 16 && C < 16 + numQuestions)) {
            align = 'left'
          }

          // Special Highlight: Pernyataan Terisi Column
          if (C === 16 + numQuestions) {
            isBold = true
            if (val.includes('/') && val.split('/')[0] === val.split('/')[1] && val.split('/')[0] !== '0') {
              cellBg = 'DCFCE7' // Soft Light Green for complete
              fontColor = '166534'
            } else if (val.startsWith('0/')) {
              cellBg = 'FEE2E2' // Soft Light Red for unattempted
              fontColor = '991B1B'
            } else {
              cellBg = 'FEF3C7' // Soft Light Amber for partial
              fontColor = '92400E'
            }
          }

          // Special Highlight: REI Score Columns
          if (C > 16 + numQuestions && C <= 16 + numQuestions + 3) {
            isBold = true
            cellBg = isEven ? 'F0FDF4' : 'DCFCE7'
            fontColor = '15803D'
          }

          // Special Highlight: REI Category Columns
          if (C > 16 + numQuestions + 3) {
            isBold = true
            if (val === 'Tinggi' || val === 'Sangat Baik' || val === 'Kamu Hebat!') {
              fontColor = '15803D'
            } else if (val === 'Sedang' || val === 'Baik' || val === 'Kamu Sudah Bagus!') {
              fontColor = 'B45309'
            } else if (val === 'Rendah' || val === 'Cukup' || val === 'Belum' || val === 'Ayo Kita Latih Sama-Sama!') {
              fontColor = 'B91C1C'
            }
          }

          ws[address].s = {
            fill: { fgColor: { rgb: cellBg } },
            font: { name: 'Calibri', sz: 10, bold: isBold, color: { rgb: fontColor } },
            alignment: { horizontal: align, vertical: 'center', wrapText: true },
            border: thinBorder,
          }
        }
      }

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "User Results")

      // Generate filename with timestamp
      const challengeTitle = challenges.find(c => c.id === selectedChallengeId)?.title || "Challenge"
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `${challengeTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_Results_${timestamp}.xlsx`

      // Download file
      XLSX.writeFile(wb, filename)

      toast({
        title: "Success",
        description: "Results exported successfully",
      })
    } catch (error) {
      console.error("Error exporting to Excel:", error)
      toast({
        title: "Error",
        description: "Failed to export results",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  // Filtered and paginated results
  const filteredResults = results.filter(r => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (
      r.user_name.toLowerCase().includes(term) ||
      r.user_school.toLowerCase().includes(term) ||
      r.user_class.toLowerCase().includes(term) ||
      (r.education_level && r.education_level.toLowerCase().includes(term)) ||
      r.user_id.toLowerCase().includes(term)
    )
  })

  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredResults.length / pageSize) || 1
  const startIndex = pageSize === -1 ? 0 : (currentPage - 1) * pageSize
  const paginatedResults = pageSize === -1 
    ? filteredResults 
    : filteredResults.slice(startIndex, startIndex + pageSize)

  // Get all unique questions for table headers using helper function
  const sortedQuestionsEntries = getSortedQuestions(results, challengeQuestions)
  const sortedQuestions = sortedQuestionsEntries.map(([questionId]) => questionId)
  const questionDetails = new Map(sortedQuestionsEntries)

  return (
    <div className="flex h-screen bg-gray-100">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 overflow-hidden bg-gray-100 p-6">
          <div className="h-full max-w-full mx-auto space-y-6 flex flex-col">
            
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">User Results Summary</h1>
                <p className="text-gray-600 text-sm">View comprehensive student demographic, sports profile, and REI assessment results</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Select value={selectedChallengeId} onValueChange={setSelectedChallengeId}>
                  <SelectTrigger className="w-[230px] bg-white shadow-xs">
                    <SelectValue placeholder="Select a challenge" />
                  </SelectTrigger>
                  <SelectContent>
                    {challenges.map((challenge) => (
                      <SelectItem key={challenge.id} value={challenge.id}>
                        {challenge.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  onClick={() => setShowSportsInfo(!showSportsInfo)}
                  className="flex items-center gap-2 bg-white shadow-xs"
                  title="Toggle sports profile information"
                >
                  <Activity className={`h-4 w-4 ${showSportsInfo ? "text-emerald-600" : "text-gray-400"}`} />
                  {showSportsInfo ? "Hide Profil Olahraga" : "Show Profil Olahraga"}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setShowQuestions(!showQuestions)}
                  className="flex items-center gap-2 bg-white shadow-xs"
                  title={showQuestions ? "Hide questions to see summary directly" : "Show question answers"}
                >
                  {showQuestions ? (
                    <>
                      <EyeOff className="h-4 w-4 text-gray-500" />
                      Hide Soal
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 text-blue-600" />
                      Show Soal
                    </>
                  )}
                </Button>

                <Button
                  onClick={exportToExcel}
                  disabled={loading || exporting || results.length === 0}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white shadow-xs"
                >
                  {exporting ? (
                    <>
                      <FileSpreadsheet className="h-4 w-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Export to Excel
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-shrink-0">
              <Card className="shadow-xs border-gray-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-700">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{results.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Students participating in this challenge
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-xs border-gray-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-700">Questions</CardTitle>
                  <Target className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{sortedQuestions.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {is13Plus ? "45 questions (15 R, 15 E, 15 I)" : "15 questions (5 R, 5 E, 5 I)"}
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-xs border-gray-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-700">Active Challenge</CardTitle>
                  <Trophy className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-base font-bold text-gray-900 truncate">
                    {challenges.find(c => c.id === selectedChallengeId)?.title || "None"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Evaluation mode: {is13Plus ? "Mean Average (Scale 1-5)" : "Score Accumulation"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Results Table Card */}
            <Card className="flex-1 flex flex-col overflow-hidden shadow-sm border-gray-200">
              <CardHeader className="flex-shrink-0 pb-3 border-b bg-gray-50/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Assessment Overview</CardTitle>
                    <CardDescription className="text-xs">
                      {showQuestions 
                        ? "Horizontal scroll available. User Info column stays pinned on the left."
                        : "Compact summary mode. Viewing demographic, sports profile, progress, and REI scores."}
                    </CardDescription>
                  </div>

                  {/* Search and Row Count Filters */}
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Cari nama, sekolah, jenjang, kelas..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value)
                          setCurrentPage(1)
                        }}
                        className="pl-8 w-[260px] h-9 text-xs bg-white shadow-2xs"
                      />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span>Baris:</span>
                      <Select 
                        value={String(pageSize)} 
                        onValueChange={(val) => {
                          setPageSize(Number(val))
                          setCurrentPage(1)
                        }}
                      >
                        <SelectTrigger className="w-[85px] h-9 text-xs bg-white shadow-2xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="-1">Semua</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
                {loading ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : filteredResults.length === 0 ? (
                  <div className="flex justify-center items-center h-full text-gray-500 text-sm">
                    {searchTerm ? "Tidak ada data yang cocok dengan pencarian" : "Belum ada hasil untuk challenge ini"}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div
                      className="flex-1 overflow-auto bg-white"
                      style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#cbd5e1 #f1f5f9'
                      }}
                    >
                      <table className="w-full border-collapse" style={{ minWidth: 'max-content' }}>
                        <thead className="sticky top-0 bg-white z-30 border-b shadow-2xs text-gray-700">
                          <tr>
                            {/* Sticky Left: User Identity */}
                            <th 
                              className="sticky left-0 bg-slate-50 border-r-2 border-gray-200 z-40 p-3.5 text-left font-semibold text-xs border-b shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]" 
                              style={{ minWidth: '220px' }}
                            >
                              <div className="flex items-center gap-1.5 text-slate-800">
                                <UserIcon className="h-3.5 w-3.5 text-slate-600" />
                                <span>Identitas Siswa</span>
                              </div>
                              <span className="text-[11px] text-gray-500 font-normal">Nama, Sekolah & Waktu</span>
                            </th>

                            {/* Sports & Demographic Profile Column */}
                            {showSportsInfo && (
                              <th 
                                className="p-3.5 text-left font-semibold text-xs border-b border-r bg-emerald-50/70 text-emerald-950" 
                                style={{ minWidth: '260px' }}
                              >
                                <div className="flex items-center gap-1.5">
                                  <Activity className="h-3.5 w-3.5 text-emerald-700" />
                                  <span>Profil Siswa & Olahraga</span>
                                </div>
                                <span className="text-[11px] text-emerald-700/80 font-normal">Jenjang, Klub, Frekuensi & Lomba</span>
                              </th>
                            )}

                            {/* Question Columns (Conditional) */}
                            {showQuestions && sortedQuestions.map((questionId, index) => (
                              <th key={questionId} className="p-3.5 text-left font-semibold text-xs border-b border-r bg-blue-50/70 text-blue-950" style={{ minWidth: '260px' }}>
                                <div className="space-y-1">
                                  <div className="font-bold text-blue-700">
                                    Soal {questionDetails.get(questionId)?.number || (index + 1)}
                                  </div>
                                  <div className="font-normal text-[11px] text-gray-600 leading-tight" style={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                  }}>
                                    {questionDetails.get(questionId)?.text || ""}
                                  </div>
                                </div>
                              </th>
                            ))}

                            {/* Pernyataan Terisi */}
                            <th className="p-3.5 text-center font-semibold text-xs border-b border-r bg-amber-50/80 text-amber-950" style={{ minWidth: '140px' }}>
                              <div className="font-bold text-amber-800">
                                Pernyataan Terisi
                              </div>
                              <div className="font-normal text-[11px] text-amber-700/80">
                                (Terisi / Total)
                              </div>
                            </th>

                            {/* REI Scores */}
                            <th className="p-3.5 text-left font-semibold text-xs border-b border-r bg-green-50/80 text-green-950" style={{ minWidth: '130px' }}>
                              <div className="font-bold text-green-800">
                                {is13Plus ? "REI Rerata (Mean)" : "REI Skor"}
                              </div>
                              <div className="font-normal text-[11px] text-green-700/80">
                                {is13Plus ? "Skala 1.00 – 5.00" : "Poin Indikator"}
                              </div>
                            </th>

                            {/* Category Labels */}
                            <th className="p-3.5 text-left font-semibold text-xs border-b bg-green-50/80 text-green-950" style={{ minWidth: '200px' }}>
                              <div className="font-bold text-green-800">
                                Kategori & Label
                              </div>
                              <div className="font-normal text-[11px] text-green-700/80">
                                {is13Plus ? "Tinggi / Sedang / Rendah" : "Kategori Anak Ramah"}
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-800">
                          {paginatedResults.map((result, rowIndex) => {
                            return (
                              <tr
                                key={result.user_id}
                                className={rowIndex % 2 === 0 ? "bg-white hover:bg-blue-50/20 transition-colors" : "bg-slate-50/40 hover:bg-blue-50/30 transition-colors"}
                              >
                                {/* Sticky Column: User Identity */}
                                <td 
                                  className="sticky left-0 bg-white border-r-2 border-gray-200 z-20 p-3.5 font-medium border-b shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]" 
                                  style={{ minWidth: '220px' }}
                                >
                                  <div className="space-y-1.5">
                                    <div className="font-bold text-sm text-gray-900 leading-tight" title={result.user_name}>
                                      {result.user_name}
                                    </div>
                                    <div className="text-xs text-gray-600 space-y-1">
                                      <div className="text-[11px] text-gray-500 font-mono">
                                        <strong>ID:</strong> {result.user_id.substring(0, 8)}...
                                      </div>
                                      <div className="flex items-center gap-1 text-gray-700 font-medium">
                                        <School className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                        <span className="truncate" title={result.user_school || "—"}>{result.user_school || "—"}</span>
                                      </div>
                                      <div className="text-[11px] text-gray-500">
                                        Kelas: <strong>{result.user_class || "—"}</strong>
                                      </div>
                                      <div className="pt-0.5 text-[11px] text-blue-600 flex items-center gap-1 font-medium">
                                        <Calendar className="h-3 w-3 inline flex-shrink-0" />
                                        <span>{formatDate(result.answered_at)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Sports & Demographics Profile Cell */}
                                {showSportsInfo && (
                                  <td className="p-3.5 text-xs border-b border-r bg-emerald-50/10" style={{ minWidth: '260px' }}>
                                    <div className="space-y-1.5 text-gray-700">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-semibold">
                                          {result.education_level || "Jenjang: —"}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px]">
                                          {result.user_gender || "—"} ({result.user_age ? `${result.user_age} th` : "—"})
                                        </span>
                                      </div>

                                      <div className="pt-1 text-[11px] space-y-1 text-gray-600 border-t border-gray-100">
                                        <div>
                                          <strong>Klub Olahraga:</strong>{" "}
                                          <span className={`inline-block px-1.5 py-0.2 rounded font-medium ${
                                            result.is_active_sports_member && result.is_active_sports_member.toLowerCase().includes("ya")
                                              ? "bg-green-100 text-green-800"
                                              : "bg-gray-100 text-gray-600"
                                          }`}>
                                            {result.is_active_sports_member || "—"}
                                          </span>
                                        </div>
                                        <div>
                                          <strong>Frekuensi & Durasi:</strong> {result.sports_frequency || "—"}{" "}
                                          {result.sports_duration ? `(${result.sports_duration})` : ""}
                                        </div>
                                        <div>
                                          <strong>Minat Olahraga:</strong> {result.sports_liking || "—"}
                                        </div>
                                        <div>
                                          <strong>Pengalaman Lomba:</strong> {result.has_sports_competition || "—"} |{" "}
                                          <strong>Tertarik:</strong> {result.likes_sports_competition || "—"}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                )}

                                {/* Question Columns (Conditional) */}
                                {showQuestions && sortedQuestions.map((questionId) => (
                                  <td key={questionId} className="p-3.5 text-xs border-b border-r" style={{ minWidth: '260px' }}>
                                    <div className="space-y-1.5">
                                      <div
                                        className="text-gray-800 leading-tight text-xs"
                                        style={{
                                          display: '-webkit-box',
                                          WebkitLineClamp: 3,
                                          WebkitBoxOrient: 'vertical',
                                          overflow: 'hidden'
                                        }}
                                        title={result.answers[questionId]?.selected_option || "No answer"}
                                      >
                                        <strong>Jawaban:</strong> {result.answers[questionId]?.selected_option || "No answer"}
                                      </div>
                                      <div>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                          Poin: {result.answers[questionId]?.score || 0}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                ))}

                                {/* Pernyataan Terisi */}
                                {(() => {
                                  const answeredCount = sortedQuestions.filter(qId => {
                                    const ans = result.answers[qId]
                                    if (!ans || !ans.selected_option) return false
                                    const trimmed = ans.selected_option.trim().toLowerCase()
                                    return trimmed !== "" && trimmed !== "no answer" && trimmed !== "—" && trimmed !== "-"
                                  }).length
                                  const totalCount = sortedQuestions.length
                                  const isComplete = totalCount > 0 && answeredCount === totalCount
                                  const isPartial = answeredCount > 0 && answeredCount < totalCount

                                  return (
                                    <td className="p-3.5 border-b border-r text-center" style={{ minWidth: '140px' }}>
                                      <div className="flex flex-col items-center justify-center gap-1">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${isComplete
                                            ? "bg-green-100 text-green-800 border border-green-300"
                                            : isPartial
                                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                                              : "bg-red-100 text-red-800 border border-red-200"
                                          }`}>
                                          {answeredCount}/{totalCount}
                                        </span>
                                        <span className="text-[11px] text-gray-500 font-medium">
                                          {isComplete ? "Lengkap" : isPartial ? "Belum Lengkap" : "Belum Mengisi"}
                                        </span>
                                      </div>
                                    </td>
                                  )
                                })()}

                                {/* REI Scores */}
                                <td className="p-3.5 border-b border-r text-xs" style={{ minWidth: '130px' }}>
                                  <div className="space-y-1 font-mono">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-gray-500 w-4">R:</span>
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
                                        result.rei_data?.respect !== undefined ? "bg-green-100 text-green-800 border border-green-200" : "bg-gray-100 text-gray-700"
                                      }`}>
                                        {formatReiScore(result.rei_data?.respect)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-gray-500 w-4">E:</span>
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
                                        result.rei_data?.equity !== undefined ? "bg-green-100 text-green-800 border border-green-200" : "bg-gray-100 text-gray-700"
                                      }`}>
                                        {formatReiScore(result.rei_data?.equity)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-gray-500 w-4">I:</span>
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
                                        result.rei_data?.inclusion !== undefined ? "bg-green-100 text-green-800 border border-green-200" : "bg-gray-100 text-gray-700"
                                      }`}>
                                        {formatReiScore(result.rei_data?.inclusion)}
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                {/* Category Labels */}
                                <td className="p-3.5 text-xs border-b" style={{ minWidth: '200px' }}>
                                  <div className="space-y-1 text-xs">
                                    <div><strong className="text-gray-600">Main:</strong> <span className="font-semibold text-gray-900">{getMainCategory(result)}</span></div>
                                    <div><strong className="text-gray-600">Respect:</strong> <span className="text-gray-800">{getRespectCategory(result)}</span></div>
                                    <div><strong className="text-gray-600">Equity:</strong> <span className="text-gray-800">{getEquityCategory(result)}</span></div>
                                    <div><strong className="text-gray-600">Inclusion:</strong> <span className="text-gray-800">{getInclusionCategory(result)}</span></div>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Bar */}
                    <div className="border-t bg-gray-50/80 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
                      <div className="text-xs text-gray-600 font-medium">
                        Menampilkan{" "}
                        <strong className="text-gray-900">
                          {filteredResults.length === 0 ? 0 : startIndex + 1}
                        </strong>{" "}
                        sampai{" "}
                        <strong className="text-gray-900">
                          {pageSize === -1 ? filteredResults.length : Math.min(startIndex + pageSize, filteredResults.length)}
                        </strong>{" "}
                        dari <strong className="text-gray-900">{filteredResults.length}</strong> siswa {searchTerm && `(difilter dari total ${results.length})`}
                      </div>

                      {pageSize !== -1 && totalPages > 1 && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                            disabled={currentPage === 1}
                            className="h-8 px-2.5 bg-white shadow-2xs text-xs font-medium"
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Prev
                          </Button>
                          
                          <span className="text-xs text-gray-700 font-medium px-2">
                            Halaman {currentPage} dari {totalPages}
                          </span>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                            disabled={currentPage >= totalPages}
                            className="h-8 px-2.5 bg-white shadow-2xs text-xs font-medium"
                          >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
