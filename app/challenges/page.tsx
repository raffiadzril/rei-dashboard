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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase, type Challenge } from "@/lib/supabase"
import { Plus, Edit, Trash2, Trophy } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    image_url: "",
  })
  const { toast } = useToast()

  useEffect(() => {
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
        alt="Challenge media"
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
      toast({
        title: "Error",
        description: "Failed to fetch challenges",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const challengeData = {
        title: formData.title,
        description: formData.description || null,
        image_url: formData.image_url || null,
      }

      if (editingChallenge) {
        const { error } = await supabase
          .from("challenges")
          .update(challengeData)
          .eq("id", editingChallenge.id)

        if (error) throw error

        toast({
          title: "Success",
          description: "Challenge updated successfully",
        })
      } else {
        const { error } = await supabase.from("challenges").insert([challengeData])

        if (error) throw error

        toast({
          title: "Success",
          description: "Challenge created successfully",
        })
      }

      setDialogOpen(false)
      setEditingChallenge(null)
      setFormData({ title: "", description: "", image_url: "" })
      fetchChallenges()
    } catch (error) {
      console.error("Error saving challenge:", error)
      toast({
        title: "Error",
        description: "Failed to save challenge",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (challenge: Challenge) => {
    setEditingChallenge(challenge)
    setFormData({
      title: challenge.title,
      description: challenge.description || "",
      image_url: challenge.image_url || "",
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this challenge?")) return

    try {
      const { error } = await supabase.from("challenges").delete().eq("id", id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Challenge deleted successfully",
      })
      fetchChallenges()
    } catch (error) {
      console.error("Error deleting challenge:", error)
      toast({
        title: "Error",
        description: "Failed to delete challenge",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({ title: "", description: "", image_url: "" })
    setEditingChallenge(null)
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
                <h1 className="text-2xl font-bold text-foreground">Challenges</h1>
                <p className="text-muted-foreground">Manage game challenges</p>
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
                    Add Challenge
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>{editingChallenge ? "Edit Challenge" : "Add New Challenge"}</DialogTitle>
                    <DialogDescription>
                      {editingChallenge ? "Update the challenge details." : "Create a new challenge for the game."}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="title">Title *</Label>
                        <Input
                          id="title"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={3}
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
                      <Button type="submit">{editingChallenge ? "Update" : "Create"}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Challenges ({challenges.length})
                </CardTitle>
                <CardDescription>A list of all challenges in the system</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="text-muted-foreground">Loading challenges...</div>
                  </div>
                ) : challenges.length === 0 ? (
                  <div className="text-center py-8">
                    <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No challenges found</h3>
                    <p className="text-muted-foreground">Get started by creating your first challenge.</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Media</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {challenges.map((challenge) => (
                          <TableRow key={challenge.id}>
                            <TableCell className="font-medium">{challenge.title}</TableCell>
                            <TableCell className="max-w-xs truncate">{challenge.description || "—"}</TableCell>
                            <TableCell>
                              {renderMedia(challenge.image_url || "")}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleEdit(challenge)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(challenge.id)}
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
