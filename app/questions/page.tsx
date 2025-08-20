"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { supabase, type Question, type Challenge } from "@/lib/supabase"
import { Plus, Edit, Trash2, HelpCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [formData, setFormData] = useState({
    challenge_id: "",
    question_text: "",
    question_number: "",
    image_url: "",
  })
  const { toast } = useToast()

  useEffect(() => {
    fetchQuestions()
    fetchChallenges()
  }, [])

  const renderMedia = (url: string, isPreview: boolean = false) => {
    if (!url) return "—";
    
    // Check if the URL is a video file based on extension or common video indicators
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.wmv'];
    const isVideo = videoExtensions.some(ext => url.toLowerCase().includes(ext)) || 
                   url.toLowerCase().includes('video') ||
                   url.toLowerCase().includes('.mp4') ||
                   url.toLowerCase().includes('youtube') ||
                   url.toLowerCase().includes('vimeo');
    
    const sizeClass = isPreview ? "h-24 w-32 rounded object-cover" : "h-10 w-16 rounded object-cover";
    
    if (isVideo) {
      return (
        <video 
          src={url} 
          className={sizeClass}
          controls
          muted
          preload="metadata"
        />
      );
    }
    
    return (
      <img
        src={url}
        alt="Question media"
        className={isPreview ? "h-24 w-24 rounded object-cover" : "h-10 w-10 rounded object-cover"}
        onError={(e) => {
          // If image fails to load, try to render as video
          const target = e.target as HTMLImageElement;
          const video = document.createElement('video');
          video.src = url;
          video.className = sizeClass;
          video.controls = true;
          video.muted = true;
          video.preload = "metadata";
          target.parentNode?.replaceChild(video, target);
        }}
      />
    );
  };

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
      toast({
        title: "Error",
        description: "Failed to fetch questions",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
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
    } catch (error) {
      console.error("Error fetching challenges:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const questionData = {
        challenge_id: formData.challenge_id,
        question_text: formData.question_text,
        question_number: formData.question_number ? parseInt(formData.question_number) : null,
        image_url: formData.image_url || null,
      }

      if (editingQuestion) {
        const { error } = await supabase
          .from("questions")
          .update(questionData)
          .eq("id", editingQuestion.id)

        if (error) throw error

        toast({
          title: "Success",
          description: "Question updated successfully",
        })
      } else {
        const { error } = await supabase.from("questions").insert([questionData])

        if (error) throw error

        toast({
          title: "Success",
          description: "Question created successfully",
        })
      }

      setDialogOpen(false)
      setEditingQuestion(null)
      setFormData({ challenge_id: "", question_text: "", question_number: "", image_url: "" })
      fetchQuestions()
    } catch (error) {
      console.error("Error saving question:", error)
      toast({
        title: "Error",
        description: "Failed to save question",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (question: Question) => {
    setEditingQuestion(question)
    setFormData({
      challenge_id: question.challenge_id,
      question_text: question.question_text,
      question_number: question.question_number?.toString() || "",
      image_url: question.image_url || "",
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return

    try {
      const { error } = await supabase.from("questions").delete().eq("id", id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Question deleted successfully",
      })
      fetchQuestions()
    } catch (error) {
      console.error("Error deleting question:", error)
      toast({
        title: "Error",
        description: "Failed to delete question",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({ challenge_id: "", question_text: "", question_number: "", image_url: "" })
    setEditingQuestion(null)
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
                <h1 className="text-2xl font-bold text-foreground">Questions</h1>
                <p className="text-muted-foreground">Manage challenge questions</p>
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
                    Add Question
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[525px]">
                  <DialogHeader>
                    <DialogTitle>{editingQuestion ? "Edit Question" : "Add New Question"}</DialogTitle>
                    <DialogDescription>
                      {editingQuestion ? "Update the question details." : "Create a new question for a challenge."}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="challenge_id">Challenge *</Label>
                        <Select
                          value={formData.challenge_id}
                          onValueChange={(value) => setFormData({ ...formData, challenge_id: value })}
                          required
                        >
                          <SelectTrigger>
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
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="question_text">Question Text *</Label>
                        <Textarea
                          id="question_text"
                          value={formData.question_text}
                          onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                          required
                          rows={3}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="question_number">Question Number</Label>
                        <Input
                          id="question_number"
                          type="number"
                          value={formData.question_number}
                          onChange={(e) => setFormData({ ...formData, question_number: e.target.value })}
                          min="1"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="image_url">Media URL (Image/Video)</Label>
                        <Input
                          id="image_url"
                          type="url"
                          placeholder="Enter image or video URL"
                          value={formData.image_url}
                          onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                        />
                        {formData.image_url && (
                          <div className="mt-2">
                            <Label className="text-sm text-gray-600">Preview:</Label>
                            <div className="mt-1">
                              {renderMedia(formData.image_url, true)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit">{editingQuestion ? "Update" : "Create"}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Questions ({questions.length})
                </CardTitle>
                <CardDescription>A list of all questions in the system</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="text-muted-foreground">Loading questions...</div>
                  </div>
                ) : questions.length === 0 ? (
                  <div className="text-center py-8">
                    <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No questions found</h3>
                    <p className="text-muted-foreground">Get started by creating your first question.</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Question #</TableHead>
                          <TableHead>Question Text</TableHead>
                          <TableHead>Challenge</TableHead>
                          <TableHead>Media</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {questions.map((question) => (
                          <TableRow key={question.id}>
                            <TableCell>
                              {question.question_number ? (
                                <Badge variant="outline">#{question.question_number}</Badge>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <div className="truncate">{question.question_text}</div>
                            </TableCell>
                            <TableCell>
                              <Badge>{question.challenge?.title || "Unknown"}</Badge>
                            </TableCell>
                            <TableCell>
                              {renderMedia(question.image_url || "")}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleEdit(question)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(question.id)}
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
