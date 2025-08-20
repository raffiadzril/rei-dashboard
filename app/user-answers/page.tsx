"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase, type UserAnswer, type User, type Question, type Option } from "@/lib/supabase"
import { Plus, Edit, Trash2, Settings, Eye } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Label } from "@/components/ui/label"

export default function UserAnswersPage() {
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [options, setOptions] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAnswer, setEditingAnswer] = useState<UserAnswer | null>(null)
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("")
  const [formData, setFormData] = useState({
    user_id: "",
    question_id: "",
    selected_option_id: "",
  })
  const { toast } = useToast()

  useEffect(() => {
    fetchUserAnswers()
    fetchUsers()
    fetchQuestions()
  }, [])

  useEffect(() => {
    if (selectedQuestionId) {
      fetchOptionsForQuestion(selectedQuestionId)
    }
  }, [selectedQuestionId])

  const fetchUserAnswers = async () => {
    try {
      const { data, error } = await supabase
        .from("user_answers")
        .select(`
          *,
          user:users(*),
          question:questions(
            *,
            challenge:challenges(*)
          ),
          selected_option:options(*)
        `)
        .order("answered_at", { ascending: false })

      if (error) {
        throw error
      }

      setUserAnswers(data || [])
    } catch (error) {
      console.error("Error fetching user answers:", error)
      toast({
        title: "Error",
        description: "Failed to fetch user answers",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("name", { ascending: true })

      if (error) {
        throw error
      }

      setUsers(data || [])
    } catch (error) {
      console.error("Error fetching users:", error)
    }
  }

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from("questions")
        .select(`
          *,
          challenge:challenges(*)
        `)
        .order("question_number", { ascending: true })

      if (error) {
        throw error
      }

      setQuestions(data || [])
    } catch (error) {
      console.error("Error fetching questions:", error)
    }
  }

  const fetchOptionsForQuestion = async (questionId: string) => {
    try {
      const { data, error } = await supabase
        .from("options")
        .select("*")
        .eq("question_id", questionId)
        .order("option_label", { ascending: true })

      if (error) {
        throw error
      }

      setOptions(data || [])
    } catch (error) {
      console.error("Error fetching options:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const answerData = {
        user_id: formData.user_id,
        question_id: formData.question_id,
        selected_option_id: formData.selected_option_id || null,
      }

      if (editingAnswer) {
        const { error } = await supabase
          .from("user_answers")
          .update(answerData)
          .eq("id", editingAnswer.id)

        if (error) throw error

        toast({
          title: "Success",
          description: "User answer updated successfully",
        })
      } else {
        const { error } = await supabase.from("user_answers").insert([answerData])

        if (error) throw error

        toast({
          title: "Success",
          description: "User answer created successfully",
        })
      }

      setDialogOpen(false)
      setEditingAnswer(null)
      setFormData({ user_id: "", question_id: "", selected_option_id: "" })
      setSelectedQuestionId("")
      fetchUserAnswers()
    } catch (error) {
      console.error("Error saving user answer:", error)
      toast({
        title: "Error",
        description: "Failed to save user answer",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (answer: UserAnswer) => {
    setEditingAnswer(answer)
    setFormData({
      user_id: answer.user_id,
      question_id: answer.question_id,
      selected_option_id: answer.selected_option_id || "",
    })
    setSelectedQuestionId(answer.question_id)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user answer?")) return

    try {
      const { error } = await supabase.from("user_answers").delete().eq("id", id)

      if (error) throw error

      toast({
        title: "Success",
        description: "User answer deleted successfully",
      })
      fetchUserAnswers()
    } catch (error) {
      console.error("Error deleting user answer:", error)
      toast({
        title: "Error",
        description: "Failed to delete user answer",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({ user_id: "", question_id: "", selected_option_id: "" })
    setEditingAnswer(null)
    setSelectedQuestionId("")
    setOptions([])
  }

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">User Answers</h1>
                <p className="text-muted-foreground">Manage user responses to questions</p>
              </div>
              <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                  setDialogOpen(open)
                  if (!open) resetForm()
                }}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Answer
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[525px]">
                  <DialogHeader>
                    <DialogTitle>{editingAnswer ? "Edit User Answer" : "Add New User Answer"}</DialogTitle>
                    <DialogDescription>
                      {editingAnswer ? "Update the user answer details." : "Record a new user answer to a question."}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="user_id">User *</Label>
                        <Select
                          value={formData.user_id}
                          onValueChange={(value) => setFormData({ ...formData, user_id: value })}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a user" />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name} ({user.school})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="question_id">Question *</Label>
                        <Select
                          value={formData.question_id}
                          onValueChange={(value) => {
                            setFormData({ ...formData, question_id: value, selected_option_id: "" })
                            setSelectedQuestionId(value)
                          }}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a question" />
                          </SelectTrigger>
                          <SelectContent>
                            {questions.map((question) => (
                              <SelectItem key={question.id} value={question.id}>
                                <div className="flex flex-col items-start">
                                  <span className="truncate max-w-xs">{question.question_text}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {question.challenge?.title} - Q#{question.question_number}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedQuestionId && (
                        <div className="grid gap-2">
                          <Label htmlFor="selected_option_id">Selected Option</Label>
                          <Select
                            value={formData.selected_option_id}
                            onValueChange={(value) => setFormData({ ...formData, selected_option_id: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select an option" />
                            </SelectTrigger>
                            <SelectContent>
                              {options.map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                  {option.option_label}: {option.option_text}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button type="submit">{editingAnswer ? "Update" : "Create"}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  User Answers ({userAnswers.length})
                </CardTitle>
                <CardDescription>A list of all user responses in the system</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="text-muted-foreground">Loading user answers...</div>
                  </div>
                ) : userAnswers.length === 0 ? (
                  <div className="text-center py-8">
                    <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No user answers found</h3>
                    <p className="text-muted-foreground">No responses have been recorded yet.</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Question</TableHead>
                          <TableHead>Selected Option</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Answered At</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userAnswers.map((answer) => (
                          <TableRow key={answer.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{answer.user?.name}</span>
                                <span className="text-xs text-muted-foreground">{answer.user?.school}</span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <div className="flex flex-col">
                                <span className="truncate text-sm">{answer.question?.question_text}</span>
                                <span className="text-xs text-muted-foreground">
                                  {answer.question?.challenge?.title} - Q#{answer.question?.question_number}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs">
                              {answer.selected_option ? (
                                <div className="flex flex-col">
                                  <Badge variant="outline">{answer.selected_option.option_label}</Badge>
                                  <span className="text-xs truncate mt-1">{answer.selected_option.option_text}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">No option selected</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {answer.selected_option?.score_option !== null && answer.selected_option?.score_option !== undefined ? (
                                <Badge variant="secondary">{answer.selected_option.score_option}</Badge>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>
                              {answer.answered_at ? (
                                <span className="text-sm">
                                  {new Date(answer.answered_at).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleEdit(answer)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(answer.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
