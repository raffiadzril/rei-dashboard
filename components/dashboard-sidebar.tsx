"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Users,
  Trophy,
  HelpCircle,
  Settings,
  MessageSquare,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Home,
  FileSpreadsheet,
} from "lucide-react"

const sidebarItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: Home,
  },
  {
    title: "Users",
    href: "/users",
    icon: Users,
  },
  {
    title: "Challenges",
    href: "/challenges",
    icon: Trophy,
  },
  {
    title: "Questions",
    href: "/questions",
    icon: HelpCircle,
  },
  {
    title: "Options",
    href: "/options",
    icon: MessageSquare,
  },
  {
    title: "User Answers",
    href: "/user-answers",
    icon: Settings,
  },
  {
    title: "Results Summary",
    href: "/results",
    icon: FileSpreadsheet,
  },
  {
    title: "REI Analytics",
    href: "/rei-analytics",
    icon: BarChart3,
  },
]

interface DashboardSidebarProps {
  className?: string
}

export function DashboardSidebar({ className }: DashboardSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <div
      className={cn(
        "relative flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64",
        className,
      )}
    >
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
        {!collapsed && <h2 className="text-lg font-semibold text-sidebar-foreground">REI Dashboard</h2>}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    collapsed && "px-2",
                    isActive && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90",
                  )}
                >
                  <Icon className={cn("h-4 w-4", !collapsed && "mr-3")} />
                  {!collapsed && <span>{item.title}</span>}
                </Button>
              </Link>
            )
          })}
        </nav>
      </ScrollArea>
    </div>
  )
}
