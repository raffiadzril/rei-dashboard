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
import { supabase, type Option, type Question, type Challenge } from "@/lib/supabase"
import { Plus, Edit, Trash2, MessageSquare } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function OptionsPage() {
  const [options, setOptions] = useState<Option[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingOption, setEditingOption] = useState<Option | null>(null)
  const [formData, setFormData] = useState({
    question_id: "",
    option_label: "",
    option_text: "",
    image_url: "",
    score_option: "",
  })
  const { toast } = useToast()

  useEffect(() => {
    fetchOptions()
    fetchQuestions()
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
        alt="Option media"
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

  const fetchOptions = async () => {
    try {
      const { data, error } = await supabase
        .from("options")
        .select(`
          *,
          question:questions(
            *,
            challenge:challenges(*)
          )
        `)
        .order("question_id", { ascending: true })

      if (error) {
        throw error
      }

      setOptions(data || [])
    } catch (error) {
      console.error("Error fetching options:", error)
      toast({
        title: "Error",
        description: "Failed to fetch options",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const optionData = {
        question_id: formData.question_id,
        option_label: formData.option_label || null,
        option_text: formData.option_text || null,
        image_url: formData.image_url || null,
        score_option: formData.score_option ? parseInt(formData.score_option) : null,
      }

      if (editingOption) {
        const { error } = await supabase
          .from("options")
          .update(optionData)
          .eq("id", editingOption.id)

        if (error) throw error

        toast({
          title: "Success",
          description: "Option updated successfully",
        })
      } else {
        const { error } = await supabase.from("options").insert([optionData])

        if (error) throw error

        toast({
          title: "Success",
          description: "Option created successfully",
        })
      }

      setDialogOpen(false)
      setEditingOption(null)
      setFormData({ question_id: "", option_label: "", option_text: "", image_url: "", score_option: "" })
      fetchOptions()
    } catch (error) {
      console.error("Error saving option:", error)
      toast({
        title: "Error",
        description: "Failed to save option",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (option: Option) => {
    setEditingOption(option)
    setFormData({
      question_id: option.question_id,
      option_label: option.option_label || "",
      option_text: option.option_text || "",
      image_url: option.image_url || "",
      score_option: option.score_option?.toString() || "",
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this option?")) return

    try {
      const { error } = await supabase.from("options").delete().eq("id", id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Option deleted successfully",
      })
      fetchOptions()
    } catch (error) {
      console.error("Error deleting option:", error)
      toast({
        title: "Error",
        description: "Failed to delete option",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({ question_id: "", option_label: "", option_text: "", image_url: "", score_option: "" })
    setEditingOption(null)
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
                <h1 className="text-2xl font-bold text-foreground">Options</h1>
                <p className="text-muted-foreground">Manage question answer options</p>
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
                    Add Option
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[525px]">
                  <DialogHeader>
                    <DialogTitle>{editingOption ? "Edit Option" : "Add New Option"}</DialogTitle>
                    <DialogDescription>
                      {editingOption ? "Update the option details." : "Create a new answer option for a question."}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="question_id">Question *</Label>
                        <Select
                          value={formData.question_id}
                          onValueChange={(value) => setFormData({ ...formData, question_id: value })}
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
                      <div className="grid gap-2">
                        <Label htmlFor="option_label">Option Label</Label>
                        <Input
                          id="option_label"
                          value={formData.option_label}
                          onChange={(e) => setFormData({ ...formData, option_label: e.target.value })}
                          placeholder="e.g., A, B, C, D"
                          maxLength={1}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="option_text">Option Text</Label>
                        <Textarea
                          id="option_text"
                          value={formData.option_text}
                          onChange={(e) => setFormData({ ...formData, option_text: e.target.value })}
                          rows={3}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="score_option">Score</Label>
                        <Input
                          id="score_option"
                          type="number"
                          value={formData.score_option}
                          onChange={(e) => setFormData({ ...formData, score_option: e.target.value })}
                          min="0"
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
                      <Button type="submit">{editingOption ? "Update" : "Create"}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Options ({options.length})
                </CardTitle>
                <CardDescription>A list of all answer options in the system</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="text-muted-foreground">Loading options...</div>
                  </div>
                ) : options.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No options found</h3>
                    <p className="text-muted-foreground">Get started by creating your first option.</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Label</TableHead>
                          <TableHead>Option Text</TableHead>
                          <TableHead>Question</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Media</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {options.map((option) => (
                          <TableRow key={option.id}>
                            <TableCell>
                              {option.option_label ? (
                                <Badge variant="outline">{option.option_label}</Badge>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <div className="truncate">{option.option_text || "—"}</div>
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <div className="flex flex-col">
                                <span className="truncate text-sm">{option.question?.question_text}</span>
                                <span className="text-xs text-muted-foreground">
                                  {option.question?.challenge?.title} - Q#{option.question?.question_number}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {option.score_option !== null ? (
                                <Badge variant="secondary">{option.score_option}</Badge>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>
                              {renderMedia(option.image_url || "")}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleEdit(option)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(option.id)}
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
