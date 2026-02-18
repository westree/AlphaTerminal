"use client"

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Disclosure } from "@/types/disclosure";
import { ExternalLink, Filter, RefreshCw, Search, Loader2 } from "lucide-react";

export default function Home() {
  const [data, setData] = useState<Disclosure[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/disclosures");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error(error);
      // Fallback to empty or error state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
          AlphaTerminal
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400">
            {loading ? "更新中..." : `最終更新: ${new Date().toLocaleTimeString()}`}
          </span>
          <Button size="sm" variant="outline" onClick={fetchData} disabled={loading} className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-white">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            更新
          </Button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2 w-1/3">
          <div className="relative w-full">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-zinc-500" />
            <Input placeholder="銘柄コード、キーワードで検索..." className="pl-8 bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-700" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-dashed border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white">
            <Filter className="mr-2 h-4 w-4" />
            フィルター
          </Button>
          {/* ここに重要度フィルタなどを追加 */}
        </div>
      </div>

      {/* Data Table Component (Mock) */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="rounded-md border border-zinc-800 bg-zinc-900/50">
          <Table>
            <TableHeader className="bg-zinc-900">
              <TableRow className="hover:bg-zinc-900/80 border-zinc-800">
                <TableHead className="w-[80px] text-zinc-400">時刻</TableHead>
                <TableHead className="w-[90px] text-zinc-400">コード</TableHead>
                <TableHead className="w-[180px] text-zinc-400">会社名</TableHead>
                <TableHead className="text-zinc-400">タイトル / AI要約</TableHead>
                <TableHead className="w-[100px] text-zinc-400">重要度</TableHead>
                <TableHead className="w-[120px] text-zinc-400">タグ</TableHead>
                <TableHead className="w-[80px] text-right text-zinc-400">開示</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                      <span className="text-zinc-500">Loading disclosures...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-zinc-500">
                    No disclosures found.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item) => (
                  <TableRow key={item.id} className="hover:bg-zinc-900/80 border-zinc-800 group transition-colors">
                    <TableCell className="font-mono text-zinc-400">{item.time}</TableCell>
                    <TableCell className="font-mono text-zinc-300">{item.code}</TableCell>
                    <TableCell className="font-medium text-zinc-200">{item.companyName}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 py-1">
                        <span className="text-base font-medium leading-none text-zinc-100 group-hover:text-blue-400 transition-colors cursor-pointer">
                          {item.title}
                        </span>
                        {item.aiStatus === "done" && (
                          <p className="text-sm text-zinc-400 line-clamp-1">
                            🤖 {item.summary}
                          </p>
                        )}
                        {item.aiStatus === "pending" && (
                          <p className="text-sm text-zinc-500 italic line-clamp-1">
                            ⏳ 解析中...
                          </p>
                        )}
                        {item.aiStatus === "error" && (
                          <p className="text-sm text-red-400/80 line-clamp-1">
                            ⚠️ 解析失敗
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.importance === "high" && (
                        <Badge variant="destructive" className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-0">High</Badge>
                      )}
                      {item.importance === "medium" && (
                        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border-0">Medium</Badge>
                      )}
                      {item.importance === "low" && (
                        <Badge variant="outline" className="text-zinc-500 border-zinc-700 bg-transparent">Low</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {item.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-900/20 hover:text-blue-400 text-zinc-500">
                        <Link href={item.url} target="_blank">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}
