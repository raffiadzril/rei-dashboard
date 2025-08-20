"use client"

import { useEffect, useState } from "react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { Users, Trophy, HelpCircle, BarChart3, TrendingUp, Award } from "lucide-react"

interface DashboardStats {
  totalUsers: number
  totalChallenges: number
  totalQuestions: number
  totalAnswers: number
  avgRespectScore: number
  avgEquityScore: number
  avgInclusionScore: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalChallenges: 0,
    totalQuestions: 0,
    totalAnswers: 0,
    avgRespectScore: 0,
    avgEquityScore: 0,
    avgInclusionScore: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      const [usersResult, challengesResult, questionsResult, answersResult, reiResult] = await Promise.all([
        supabase.from("users").select("*", { count: "exact", head: true }),
        supabase.from("challenges").select("*", { count: "exact", head: true }),
        supabase.from("questions").select("*", { count: "exact", head: true }),
        supabase.from("user_answers").select("*", { count: "exact", head: true }),
        supabase.from("rei_accumulate").select("respect, equity, inclusion"),
      ])

      // Calculate averages for REI scores
      let avgRespect = 0,
        avgEquity = 0,
        avgInclusion = 0
      if (reiResult.data && reiResult.data.length > 0) {
        const validScores = reiResult.data.filter(
          (item) => item.respect !== null && item.equity !== null && item.inclusion !== null,
        )
        if (validScores.length > 0) {
          avgRespect = validScores.reduce((sum, item) => sum + (item.respect || 0), 0) / validScores.length
          avgEquity = validScores.reduce((sum, item) => sum + (item.equity || 0), 0) / validScores.length
          avgInclusion = validScores.reduce((sum, item) => sum + (item.inclusion || 0), 0) / validScores.length
        }
      }

      setStats({
        totalUsers: usersResult.count || 0,
        totalChallenges: challengesResult.count || 0,
        totalQuestions: questionsResult.count || 0,
        totalAnswers: answersResult.count || 0,
        avgRespectScore: Math.round(avgRespect * 100) / 100,
        avgEquityScore: Math.round(avgEquity * 100) / 100,
        avgInclusionScore: Math.round(avgInclusion * 100) / 100,
      })
    } catch (error) {
      console.error("Error fetching dashboard stats:", error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      description: "Registered users in the system",
      icon: Users,
      color: "text-chart-1",
    },
    {
      title: "Challenges",
      value: stats.totalChallenges,
      description: "Available challenges",
      icon: Trophy,
      color: "text-chart-2",
    },
    {
      title: "Questions",
      value: stats.totalQuestions,
      description: "Total questions across all challenges",
      icon: HelpCircle,
      color: "text-chart-3",
    },
    {
      title: "User Answers",
      value: stats.totalAnswers,
      description: "Responses submitted by users",
      icon: BarChart3,
      color: "text-chart-4",
    },
  ]

  const reiScores = [
    {
      title: "Respect Score",
      value: stats.avgRespectScore,
      description: "Average respect score across all users",
      icon: Award,
      color: "text-primary",
    },
    {
      title: "Equity Score",
      value: stats.avgEquityScore,
      description: "Average equity score across all users",
      icon: TrendingUp,
      color: "text-secondary",
    },
    {
      title: "Inclusion Score",
      value: stats.avgInclusionScore,
      description: "Average inclusion score across all users",
      icon: Award,
      color: "text-accent",
    },
  ]

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard Overview</h2>
              <p className="text-muted-foreground">
                Welcome to the REI Dashboard - Monitor your Respect, Equity, and Inclusion initiatives
              </p>
            </div>

            {/* System Statistics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {statCards.map((card) => {
                const Icon = card.icon
                return (
                  <Card key={card.title} className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                      <Icon className={`h-4 w-4 ${card.color}`} />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{loading ? "..." : card.value.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground">{card.description}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* REI Scores */}
            <div>
              <h3 className="text-xl font-semibold mb-4 text-foreground">REI Performance Metrics</h3>
              <div className="grid gap-4 md:grid-cols-3">
                {reiScores.map((score) => {
                  const Icon = score.icon
                  return (
                    <Card key={score.title} className="hover:shadow-md transition-shadow">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{score.title}</CardTitle>
                        <Icon className={`h-4 w-4 ${score.color}`} />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{loading ? "..." : score.value}</div>
                        <p className="text-xs text-muted-foreground">{score.description}</p>
                        <div className="mt-2">
                          <Badge
                            variant={score.value >= 7 ? "default" : score.value >= 5 ? "secondary" : "destructive"}
                          >
                            {score.value >= 7 ? "Excellent" : score.value >= 5 ? "Good" : "Needs Improvement"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks and navigation shortcuts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Card className="p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors">
                    <div className="flex items-center space-x-2">
                      <Users className="h-5 w-5 text-primary" />
                      <span className="font-medium">Manage Users</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Add, edit, or view user profiles</p>
                  </Card>

                  <Card className="p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors">
                    <div className="flex items-center space-x-2">
                      <Trophy className="h-5 w-5 text-secondary" />
                      <span className="font-medium">Create Challenge</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Design new REI challenges</p>
                  </Card>

                  <Card className="p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="h-5 w-5 text-accent" />
                      <span className="font-medium">View Analytics</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Analyze REI performance data</p>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
