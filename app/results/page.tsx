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
import { Download, FileSpreadsheet, Users, Target, Eye, EyeOff, Search, ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from 'xlsx'

interface UserResult {
  user_id: string
  user_name: string
  user_school: string
  user_gender: string
  user_age: number
  user_class: string
  answered_at?: string
  challenge_id: string
  challenge_title: string
  answers: { [questionId: string]: { question_text: string; selected_option: string; score: number } }
  rei_data?: {
    respect: number
    equity: number
    inclusion: number
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
  
  // New features state
  const [showQuestions, setShowQuestions] = useState<boolean>(true)
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
              class
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

      // Fallback: If any user doesn't have rei_data or has empty values in rei_accumulate, compute it from their answers
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

      // Create headers with proper question text and Date
      const headers = [
        "Tanggal / Waktu",
        "User Name",
        "School",
        "Gender",
        "Age",
        "Class",
        "Challenge",
        ...sortedQuestions.map(([questionId, questionData]) => {
          const questionText = questionData.text || `Question ${questionData.number}`
          // Limit header length for Excel readability
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

      // Create data rows with consistent question order
      const data = results.map(result => {
        const answeredCount = sortedQuestions.filter(([questionId]) => {
          const ans = result.answers[questionId]
          if (!ans || !ans.selected_option) return false
          const trimmed = ans.selected_option.trim().toLowerCase()
          return trimmed !== "" && trimmed !== "no answer" && trimmed !== "—" && trimmed !== "-"
        }).length
        const answeredRatio = `${answeredCount}/${totalQuestions}`

        const row = [
          formatDate(result.answered_at),
          result.user_name,
          result.user_school,
          result.user_gender,
          result.user_age,
          result.user_class,
          result.challenge_title,
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

      // Set column widths for better readability
      const colWidths = [
        { wch: 18 }, // Tanggal / Waktu
        { wch: 15 }, // User Name
        { wch: 20 }, // School
        { wch: 10 }, // Gender
        { wch: 8 },  // Age
        { wch: 10 }, // Class
        { wch: 20 }, // Challenge
        ...sortedQuestions.map(() => ({ wch: 30 })), // Questions
        { wch: 20 }, // Pernyataan Terisi
        { wch: 15 }, // REI Respect
        { wch: 15 }, // REI Equity
        { wch: 15 }, // REI Inclusion
        { wch: 18 }, // REI Respect Category
        { wch: 18 }, // REI Equity Category
        { wch: 18 }, // REI Inclusion Category
        { wch: 20 }, // REI Main Category
      ]
      ws['!cols'] = colWidths

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "User Results")

      // Generate filename with timestamp
      const challengeTitle = challenges.find(c => c.id === selectedChallengeId)?.title || "Challenge"
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `${challengeTitle}_Results_${timestamp}.xlsx`

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
                <h1 className="text-3xl font-bold text-gray-900">User Results Summary</h1>
                <p className="text-gray-600">View and export user answers in a comprehensive format</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Select value={selectedChallengeId} onValueChange={setSelectedChallengeId}>
                  <SelectTrigger className="w-[220px] bg-white">
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
                  onClick={() => setShowQuestions(!showQuestions)}
                  className="flex items-center gap-2 bg-white"
                  title={showQuestions ? "Hide questions to see final scores directly" : "Show all question columns"}
                >
                  {showQuestions ? (
                    <>
                      <EyeOff className="h-4 w-4 text-gray-600" />
                      Hide Questions
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 text-blue-600" />
                      Show Questions
                    </>
                  )}
                </Button>

                <Button
                  onClick={exportToExcel}
                  disabled={loading || exporting || results.length === 0}
                  className="flex items-center gap-2"
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
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{results.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Users who completed this challenge
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Questions</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{sortedQuestions.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Total questions in challenge
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Challenge</CardTitle>
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold truncate">
                    {challenges.find(c => c.id === selectedChallengeId)?.title || "None"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Selected challenge
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Results Table Card */}
            <Card className="flex-1 flex flex-col overflow-hidden">
              <CardHeader className="flex-shrink-0 pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Results Overview</CardTitle>
                    <CardDescription>
                      {showQuestions 
                        ? "Scroll horizontally to view all questions and scores. Header remains fixed on the left."
                        : "Question columns hidden. Viewing summary and REI scores."}
                    </CardDescription>
                  </div>

                  {/* Search and Row Count Filters */}
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search student, school, class..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value)
                          setCurrentPage(1)
                        }}
                        className="pl-8 w-[240px] h-9 text-xs bg-white"
                      />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span>Rows:</span>
                      <Select 
                        value={String(pageSize)} 
                        onValueChange={(val) => {
                          setPageSize(Number(val))
                          setCurrentPage(1)
                        }}
                      >
                        <SelectTrigger className="w-[85px] h-9 text-xs bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="-1">All</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
                {loading ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : filteredResults.length === 0 ? (
                  <div className="flex justify-center items-center h-full text-gray-500">
                    {searchTerm ? "No results match your search" : "No results found for the selected challenge"}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div
                      className="flex-1 overflow-auto border-t bg-white"
                      style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#cbd5e1 #f1f5f9'
                      }}
                    >
                      <table className="w-full border-collapse" style={{ minWidth: 'max-content' }}>
                        <thead className="sticky top-0 bg-white z-30 border-b shadow-xs">
                          <tr>
                            <th 
                              className="sticky left-0 bg-white border-r-2 z-40 p-3 text-left font-semibold text-sm border-b shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" 
                              style={{ minWidth: '180px' }}
                            >
                              <div className="flex flex-col">
                                <span>User Information</span>
                                <span className="text-xs text-gray-500 font-normal">Name & Date</span>
                              </div>
                            </th>

                            {/* Question Columns (Conditional) */}
                            {showQuestions && sortedQuestions.map((questionId, index) => (
                              <th key={questionId} className="p-3 text-left font-semibold text-sm border-b bg-blue-50/70" style={{ minWidth: '280px' }}>
                                <div className="space-y-1">
                                  <div className="font-bold text-blue-700">
                                    Question {questionDetails.get(questionId)?.number || (index + 1)}
                                  </div>
                                  <div className="font-normal text-xs text-gray-600 leading-tight" style={{
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

                            <th className="p-3 text-center font-semibold text-sm border-b bg-amber-50" style={{ minWidth: '140px' }}>
                              <div className="space-y-1">
                                <div className="font-bold text-amber-800">
                                  Pernyataan Terisi
                                </div>
                                <div className="font-normal text-xs text-gray-500">
                                  (Terisi / Total)
                                </div>
                              </div>
                            </th>
                            <th className="p-3 text-left font-semibold text-sm border-b bg-green-50" style={{ minWidth: '110px' }}>
                              REI Scores
                            </th>
                            <th className="p-3 text-left font-semibold text-sm border-b bg-green-50" style={{ minWidth: '220px' }}>
                              Category Labels
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedResults.map((result, rowIndex) => {
                            return (
                              <tr
                                key={result.user_id}
                                className={rowIndex % 2 === 0 ? "bg-white hover:bg-gray-50/80" : "bg-gray-50/40 hover:bg-gray-50"}
                              >
                                <td 
                                  className="sticky left-0 bg-white border-r-2 z-20 p-3 font-medium border-b shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" 
                                  style={{ minWidth: '180px' }}
                                >
                                  <div className="space-y-1.5">
                                    <div className="font-semibold text-sm text-gray-900 leading-tight" title={result.user_name}>
                                      {result.user_name}
                                    </div>
                                    <div className="text-xs text-gray-600 space-y-0.5">
                                      <div><strong>ID:</strong> {result.user_id.substring(0, 8)}...</div>
                                      <div><strong>School:</strong> {result.user_school || "—"}</div>
                                      <div><strong>Gender:</strong> {result.user_gender || "—"} | <strong>Age:</strong> {result.user_age || "—"}</div>
                                      <div><strong>Class:</strong> {result.user_class || "—"}</div>
                                      <div className="pt-1 text-[11px] text-blue-600 flex items-center gap-1 font-normal">
                                        <Calendar className="h-3 w-3 inline flex-shrink-0" />
                                        <span>{formatDate(result.answered_at)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Question Columns (Conditional) */}
                                {showQuestions && sortedQuestions.map((questionId) => (
                                  <td key={questionId} className="p-3 text-sm border-b" style={{ minWidth: '280px' }}>
                                    <div className="space-y-2">
                                      <div
                                        className="text-gray-800 leading-tight"
                                        style={{
                                          display: '-webkit-box',
                                          WebkitLineClamp: 3,
                                          WebkitBoxOrient: 'vertical',
                                          overflow: 'hidden'
                                        }}
                                        title={result.answers[questionId]?.selected_option || "No answer"}
                                      >
                                        <strong>Answer:</strong> {result.answers[questionId]?.selected_option || "No answer"}
                                      </div>
                                      <div>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                          Score: {result.answers[questionId]?.score || 0}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                ))}

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
                                    <td className="p-3 border-b text-center" style={{ minWidth: '140px' }}>
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

                                <td className="p-3 border-b text-sm" style={{ minWidth: '110px' }}>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-medium w-4">R:</span>
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${result.rei_data?.respect !== undefined ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                                        }`}>
                                        {formatReiScore(result.rei_data?.respect)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-medium w-4">E:</span>
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${result.rei_data?.equity !== undefined ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                                        }`}>
                                        {formatReiScore(result.rei_data?.equity)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-medium w-4">I:</span>
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${result.rei_data?.inclusion !== undefined ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                                        }`}>
                                        {formatReiScore(result.rei_data?.inclusion)}
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                <td className="p-3 text-sm border-b" style={{ minWidth: '220px' }}>
                                  <div className="space-y-1 text-xs">
                                    <div><strong>Main:</strong> {getMainCategory(result)}</div>
                                    <div><strong>Respect:</strong> {getRespectCategory(result)}</div>
                                    <div><strong>Equity:</strong> {getEquityCategory(result)}</div>
                                    <div><strong>Inclusion:</strong> {getInclusionCategory(result)}</div>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Bar */}
                    <div className="border-t bg-gray-50 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
                      <div className="text-xs text-gray-600">
                        Showing{" "}
                        <strong>
                          {filteredResults.length === 0 ? 0 : startIndex + 1}
                        </strong>{" "}
                        to{" "}
                        <strong>
                          {pageSize === -1 ? filteredResults.length : Math.min(startIndex + pageSize, filteredResults.length)}
                        </strong>{" "}
                        of <strong>{filteredResults.length}</strong> users {searchTerm && `(filtered from ${results.length})`}
                      </div>

                      {pageSize !== -1 && totalPages > 1 && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                            disabled={currentPage === 1}
                            className="h-8 px-2 bg-white"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            <span className="sr-only">Previous</span>
                          </Button>
                          
                          <span className="text-xs text-gray-700 font-medium px-2">
                            Page {currentPage} of {totalPages}
                          </span>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                            disabled={currentPage >= totalPages}
                            className="h-8 px-2 bg-white"
                          >
                            <ChevronRight className="h-4 w-4" />
                            <span className="sr-only">Next</span>
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
