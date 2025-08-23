"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase, type Challenge, type Question, type Option, type User, type UserAnswer, type REIAccumulate } from "@/lib/supabase"
import { Download, FileSpreadsheet, Users, Target } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from 'xlsx'

interface UserResult {
  user_id: string
  user_name: string
  user_school: string
  user_gender: string
  user_age: number
  user_class: string
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
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchChallenges()
  }, [])

  useEffect(() => {
    if (selectedChallengeId) {
      fetchResults()
    }
  }, [selectedChallengeId])

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

      // Fetch all user answers for this challenge
      const { data: userAnswers, error: answersError } = await supabase
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
        .in("question_id", questions?.map(q => q.id) || [])

      if (answersError) throw answersError

      // Fetch REI data for all users
      const uniqueUserIds = [...new Set(userAnswers?.map(ua => ua.user_id) || [])]
      const { data: reiData, error: reiError } = await supabase
        .from("rei_accumulate")
        .select("*")
        .in("user_id", uniqueUserIds)

      if (reiError) throw reiError

      // Process and group data by user
      const userResultsMap = new Map<string, UserResult>()

      userAnswers?.forEach((answer: any) => {
        const userId = answer.user_id
        const user = answer.users
        const question = answer.questions
        const option = answer.options

        if (!userResultsMap.has(userId)) {
          const userReiData = reiData?.find(rei => rei.user_id === userId)
          
          userResultsMap.set(userId, {
            user_id: userId,
            user_name: user?.name || "Unknown",
            user_school: user?.school || "",
            user_gender: user?.gender || "",
            user_age: user?.age || 0,
            user_class: user?.class || "",
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
        userResult.answers[question?.id] = {
          question_text: question?.question_text || "",
          selected_option: option?.option_text || "No answer",
          score: option?.score_option || 0
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
      // Get all unique questions for headers
      const allQuestions = new Set<string>()
      results.forEach(result => {
        Object.keys(result.answers).forEach(questionId => {
          allQuestions.add(questionId)
        })
      })

      // Create headers
      const headers = [
        "User Name",
        "School",
        "Gender", 
        "Age",
        "Class",
        "Challenge",
        ...Array.from(allQuestions).map(qId => {
          const question = results[0]?.answers[qId]?.question_text || `Question ${qId}`
          return question.length > 50 ? question.substring(0, 50) + "..." : question
        }),
        // REI Data headers
        "REI - Respect Score",
        "REI - Equity Score", 
        "REI - Inclusion Score",
        "REI - Respect Category",
        "REI - Equity Category",
        "REI - Inclusion Category",
        "REI - Label Anak Ramah",
        "REI - Label Respect",
        "REI - Label Equity", 
        "REI - Label Inclusion"
      ]

      // Create data rows
      const data = results.map(result => {
        const row = [
          result.user_name,
          result.user_school,
          result.user_gender,
          result.user_age,
          result.user_class,
          result.challenge_title,
          ...Array.from(allQuestions).map(qId => 
            result.answers[qId]?.selected_option || "No answer"
          ),
          // REI Data
          result.rei_data?.respect || "",
          result.rei_data?.equity || "",
          result.rei_data?.inclusion || "",
          result.rei_data?.respect_category || "",
          result.rei_data?.equity_category || "",
          result.rei_data?.inclusion_category || "",
          result.rei_data?.label_anak_ramah_category || "",
          result.rei_data?.label_anak_ramah_category_respect || "",
          result.rei_data?.label_anak_ramah_category_equity || "",
          result.rei_data?.label_anak_ramah_category_inclusion || "",
        ]
        return row
      })

      // Create workbook
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
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

  // Get all unique questions for table headers
  const allQuestions = new Set<string>()
  const questionDetails = new Map<string, { text: string; number: number }>()
  
  results.forEach(result => {
    Object.entries(result.answers).forEach(([questionId, answerData]) => {
      allQuestions.add(questionId)
      questionDetails.set(questionId, {
        text: answerData.question_text,
        number: questionDetails.get(questionId)?.number || Object.keys(questionDetails).length + 1
      })
    })
  })

  const sortedQuestions = Array.from(allQuestions).sort((a, b) => {
    const aNum = questionDetails.get(a)?.number || 0
    const bNum = questionDetails.get(b)?.number || 0
    return aNum - bNum
  })

  return (
    <div className="flex h-screen bg-gray-100">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 overflow-hidden bg-gray-100 p-6">
          <div className="h-full max-w-full mx-auto space-y-6 flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">User Results Summary</h1>
                <p className="text-gray-600">View and export user answers in a comprehensive format</p>
              </div>
              <div className="flex items-center gap-4">
                <Select value={selectedChallengeId} onValueChange={setSelectedChallengeId}>
                  <SelectTrigger className="w-[250px]">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

            {/* Results Table */}
            <Card className="flex-1 flex flex-col">
              <CardHeader>
                <CardTitle>Results Overview</CardTitle>
                <CardDescription>
                  Each row represents one user with their answers to all questions. Scroll horizontally to view all data.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 p-0">
                {loading ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : results.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No results found for the selected challenge
                  </div>
                ) : (
                  <div className="h-full border rounded-lg bg-white">
                    <div 
                      className="overflow-auto h-full"
                      style={{ 
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#cbd5e1 #f1f5f9'
                      }}
                    >
                      <table className="w-full border-collapse" style={{ minWidth: 'max-content' }}>
                        <thead className="sticky top-0 bg-white z-10 border-b">
                          <tr>
                            <th className="sticky left-0 bg-white border-r-2 z-20 p-3 text-left font-semibold text-sm border-b" style={{ minWidth: '160px' }}>
                              <div className="flex flex-col">
                                <span>User Information</span>
                                <span className="text-xs text-gray-500 font-normal">Name & Details</span>
                              </div>
                            </th>
                            {sortedQuestions.map((questionId, index) => (
                              <th key={questionId} className="p-3 text-left font-semibold text-sm border-b bg-blue-50" style={{ minWidth: '300px' }}>
                                <div className="space-y-1">
                                  <div className="font-bold text-blue-700">Question {index + 1}</div>
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
                            <th className="p-3 text-left font-semibold text-sm border-b bg-green-50" style={{ minWidth: '100px' }}>
                              REI Scores
                            </th>
                            <th className="p-3 text-left font-semibold text-sm border-b bg-green-50" style={{ minWidth: '200px' }}>
                              Category Labels
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((result, rowIndex) => (
                            <tr key={result.user_id} className={rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                              <td className="sticky left-0 bg-white border-r-2 z-10 p-3 font-medium border-b" style={{ minWidth: '160px' }}>
                                <div className="space-y-2">
                                  <div className="font-semibold text-sm text-gray-900" title={result.user_name}>
                                    {result.user_name}
                                  </div>
                                  <div className="text-xs text-gray-600 space-y-1">
                                    <div><strong>ID:</strong> {result.user_id.substring(0, 8)}...</div>
                                    <div><strong>School:</strong> {result.user_school || "—"}</div>
                                    <div><strong>Gender:</strong> {result.user_gender || "—"}</div>
                                    <div><strong>Age:</strong> {result.user_age || "—"}</div>
                                    <div><strong>Class:</strong> {result.user_class || "—"}</div>
                                  </div>
                                </div>
                              </td>
                              {sortedQuestions.map((questionId) => (
                                <td key={questionId} className="p-3 text-sm border-b" style={{ minWidth: '300px' }}>
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
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        Score: {result.answers[questionId]?.score || 0}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                              ))}
                              <td className="p-3 border-b text-sm" style={{ minWidth: '100px' }}>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-medium">R:</span>
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      result.rei_data?.respect ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                                    }`}>
                                      {result.rei_data?.respect || "—"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-medium">E:</span>
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      result.rei_data?.equity ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                                    }`}>
                                      {result.rei_data?.equity || "—"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-medium">I:</span>
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      result.rei_data?.inclusion ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                                    }`}>
                                      {result.rei_data?.inclusion || "—"}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-sm border-b" style={{ minWidth: '200px' }}>
                                <div className="space-y-1 text-xs">
                                  <div><strong>Main:</strong> {result.rei_data?.label_anak_ramah_category || "—"}</div>
                                  <div><strong>Respect:</strong> {result.rei_data?.label_anak_ramah_category_respect || "—"}</div>
                                  <div><strong>Equity:</strong> {result.rei_data?.label_anak_ramah_category_equity || "—"}</div>
                                  <div><strong>Inclusion:</strong> {result.rei_data?.label_anak_ramah_category_inclusion || "—"}</div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Scroll instruction */}
                    <div className="border-t bg-gray-50 px-4 py-2">
                      <p className="text-xs text-gray-600 text-center">
                        💡 Scroll horizontally to view all questions and REI data →
                      </p>
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
