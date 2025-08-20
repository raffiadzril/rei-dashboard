"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase, type REIAccumulate } from "@/lib/supabase"
import { BarChart3, Eye, TrendingUp, Users, Award } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function REIAnalyticsPage() {
  const [reiData, setReiData] = useState<REIAccumulate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRecord, setSelectedRecord] = useState<REIAccumulate | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    fetchREIData()
  }, [])

  const fetchREIData = async () => {
    try {
      const { data, error } = await supabase
        .from("rei_accumulate")
        .select(`
          *,
          user:users(*)
        `)
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }

      setReiData(data || [])
    } catch (error) {
      console.error("Error fetching REI data:", error)
      toast({
        title: "Error",
        description: "Failed to fetch REI analytics data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetails = (record: REIAccumulate) => {
    setSelectedRecord(record)
    setDialogOpen(true)
  }

  const getScoreColor = (score: number | null | undefined) => {
    if (score === null || score === undefined) return "secondary"
    if (score >= 80) return "default" // green-ish
    if (score >= 60) return "secondary" // yellow-ish
    return "destructive" // red-ish
  }

  const getCategoryColor = (category: string | null | undefined) => {
    if (!category) return "secondary"
    switch (category.toLowerCase()) {
      case "tinggi":
        return "default"
      case "sedang":
        return "secondary"
      case "rendah":
        return "destructive"
      default:
        return "outline"
    }
  }

  const filteredData = reiData.filter((record) =>
    record.user?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.user?.school?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Calculate summary statistics
  const totalRecords = reiData.length
  const avgRespect = reiData.reduce((sum, r) => sum + (r.respect || 0), 0) / totalRecords || 0
  const avgEquity = reiData.reduce((sum, r) => sum + (r.equity || 0), 0) / totalRecords || 0
  const avgInclusion = reiData.reduce((sum, r) => sum + (r.inclusion || 0), 0) / totalRecords || 0

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">REI Analytics</h1>
                <p className="text-muted-foreground">View REI (Respect, Equity, Inclusion) assessment results</p>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Assessments</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalRecords}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Respect</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgRespect.toFixed(1)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Equity</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgEquity.toFixed(1)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Inclusion</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgInclusion.toFixed(1)}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  REI Assessment Results ({filteredData.length})
                </CardTitle>
                <CardDescription>Assessment results showing Respect, Equity, and Inclusion scores</CardDescription>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="search">Search:</Label>
                  <Input
                    id="search"
                    placeholder="Search by name or school..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="text-muted-foreground">Loading REI analytics...</div>
                  </div>
                ) : filteredData.length === 0 ? (
                  <div className="text-center py-8">
                    <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No REI data found</h3>
                    <p className="text-muted-foreground">No assessment results have been recorded yet.</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Respect</TableHead>
                          <TableHead>Equity</TableHead>
                          <TableHead>Inclusion</TableHead>
                          <TableHead>Overall Category</TableHead>
                          <TableHead>Assessment Date</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredData.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{record.user?.name || "Unknown User"}</span>
                                <span className="text-xs text-muted-foreground">{record.user?.school}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge variant={getScoreColor(record.respect)}>{record.respect || "—"}</Badge>
                                {record.respect_category && (
                                  <Badge variant={getCategoryColor(record.respect_category)} className="text-xs">
                                    {record.respect_category}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge variant={getScoreColor(record.equity)}>{record.equity || "—"}</Badge>
                                {record.equity_category && (
                                  <Badge variant={getCategoryColor(record.equity_category)} className="text-xs">
                                    {record.equity_category}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge variant={getScoreColor(record.inclusion)}>{record.inclusion || "—"}</Badge>
                                {record.inclussion_category && (
                                  <Badge variant={getCategoryColor(record.inclussion_category)} className="text-xs">
                                    {record.inclussion_category}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {record.all_category && (
                                <Badge variant={getCategoryColor(record.all_category)}>
                                  {record.all_category}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {new Date(record.created_at).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" onClick={() => handleViewDetails(record)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Detail Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>REI Assessment Details</DialogTitle>
                  <DialogDescription>
                    Detailed view of the REI assessment for {selectedRecord?.user?.name}
                  </DialogDescription>
                </DialogHeader>
                {selectedRecord && (
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">User Information</Label>
                        <div className="mt-1 space-y-1">
                          <p className="text-sm"><strong>Name:</strong> {selectedRecord.user?.name}</p>
                          <p className="text-sm"><strong>School:</strong> {selectedRecord.user?.school}</p>
                          <p className="text-sm"><strong>Class:</strong> {selectedRecord.user?.class}</p>
                          <p className="text-sm"><strong>Age:</strong> {selectedRecord.user?.age}</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Assessment Scores</Label>
                        <div className="mt-1 space-y-1">
                          <p className="text-sm"><strong>Respect:</strong> {selectedRecord.respect || "—"}</p>
                          <p className="text-sm"><strong>Equity:</strong> {selectedRecord.equity || "—"}</p>
                          <p className="text-sm"><strong>Inclusion:</strong> {selectedRecord.inclusion || "—"}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Overall Assessment</Label>
                        <div className="mt-1 space-y-1">
                          <p className="text-sm"><strong>Category:</strong> {selectedRecord.all_category || "—"}</p>
                          <p className="text-sm"><strong>Notes:</strong> {selectedRecord.all_note || "No notes available"}</p>
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium">Respect Assessment</Label>
                        <div className="mt-1 space-y-1">
                          <p className="text-sm"><strong>Category:</strong> {selectedRecord.respect_category || "—"}</p>
                          <p className="text-sm"><strong>Notes:</strong> {selectedRecord.respect_note || "No notes available"}</p>
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium">Equity Assessment</Label>
                        <div className="mt-1 space-y-1">
                          <p className="text-sm"><strong>Category:</strong> {selectedRecord.equity_category || "—"}</p>
                          <p className="text-sm"><strong>Notes:</strong> {selectedRecord.equity_note || "No notes available"}</p>
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium">Inclusion Assessment</Label>
                        <div className="mt-1 space-y-1">
                          <p className="text-sm"><strong>Category:</strong> {selectedRecord.inclussion_category || "—"}</p>
                          <p className="text-sm"><strong>Notes:</strong> {selectedRecord.inclusion_note || "No notes available"}</p>
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium">Assessment Date</Label>
                        <p className="text-sm mt-1">
                          {new Date(selectedRecord.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </main>
      </div>
    </div>
  )
}
