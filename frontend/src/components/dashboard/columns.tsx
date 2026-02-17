"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Disclosure } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, MoreHorizontal, FileText } from "lucide-react"

export const columns: ColumnDef<Disclosure>[] = [
    {
        accessorKey: "timestamp",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Time
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
    },
    {
        accessorKey: "ticker",
        header: "Code",
        cell: ({ row }) => <div className="font-mono text-xs">{row.getValue("ticker")}</div>,
    },
    {
        accessorKey: "companyName",
        header: "Company",
        cell: ({ row }) => <div className="font-medium">{row.getValue("companyName")}</div>,
    },
    {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => {
            const summary = row.original.summary;
            return (
                <div className="max-w-[400px]">
                    <div className="font-semibold text-blue-500 hover:underline cursor-pointer">
                        {row.getValue("title")}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {summary}
                    </p>
                </div>
            )
        },
    },
    {
        accessorKey: "importance",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Imp
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const importance = row.getValue("importance") as string
            let variant: "default" | "secondary" | "destructive" | "outline" = "outline"

            if (importance === "High") variant = "destructive"
            if (importance === "Medium") variant = "secondary"
            if (importance === "Low") variant = "outline"

            return <Badge variant={variant}>{importance}</Badge>
        },
    },
    {
        accessorKey: "tags",
        header: "Tags",
        cell: ({ row }) => {
            const tags = row.getValue("tags") as string[]
            return (
                <div className="flex flex-wrap gap-1">
                    {tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                        </Badge>
                    ))}
                </div>
            )
        },
    },
    {
        id: "actions",
        cell: ({ row }) => {
            return (
                <Button variant="ghost" size="icon">
                    <FileText className="h-4 w-4" />
                </Button>
            )
        },
    },
]
