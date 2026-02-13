import { Hono } from "hono";
import { cors } from "hono/cors";
import * as cheerio from "cheerio";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── 型定義 ───────────────────────────────────────────────
type Bindings = {
    DB: D1Database;
    GOOGLE_API_KEY: string;
};

interface ReportRow {
    id: string;
    code: string;
    name: string;
    title: string;
    sales_pct: number | null;
    profit_pct: number | null;
    is_double_growth: number;
    summary: string | null;
    pdf_url: string;
    created_at: number;
}

interface GeminiAnalysis {
    sales_pct: number | null;
    profit_pct: number | null;
    summary: string;
}

interface TdnetItem {
    id: string;
    code: string;
    name: string;
    title: string;
    pdfUrl: string;
    time: string;
}

// ─── Hono アプリケーション ────────────────────────────────
const app = new Hono<{ Bindings: Bindings }>();

// CORS 設定
app.use("/api/*", cors({ origin: "*" }));

// ─── API: レポート一覧取得 ────────────────────────────────
app.get("/api/reports", async (c) => {
    const filter = c.req.query("filter"); // "double_growth" で増収増益のみ
    const limit = Math.min(Number(c.req.query("limit") || 50), 200);

    let query = "SELECT * FROM reports";
    const params: unknown[] = [];

    if (filter === "double_growth") {
        query += " WHERE is_double_growth = 1";
    }
    query += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const { results } = await c.env.DB.prepare(query)
        .bind(...params)
        .all<ReportRow>();

    return c.json({
        ok: true,
        count: results?.length ?? 0,
        data: results ?? [],
    });
});

// ─── API: ヘルスチェック ──────────────────────────────────
app.get("/api/health", (c) => {
    return c.json({ ok: true, timestamp: Date.now() });
});

// ─── TDnet スクレイピング ─────────────────────────────────
const TDNET_URL = "https://www.release.tdnet.info/inbs/I_main_00.html";
const TDNET_BASE = "https://www.release.tdnet.info/inbs/";

async function scrapeTdnet(): Promise<TdnetItem[]> {
    // 1. メインページを取得して iframe の URL を特定
    const resMain = await fetch(TDNET_URL, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
    });

    if (!resMain.ok) {
        throw new Error(`TDnet main fetch failed: ${resMain.status}`);
    }

    const htmlMain = await resMain.text();
    const $main = cheerio.load(htmlMain);
    const iframeSrc = $main("#main_list").attr("src");

    if (!iframeSrc) {
        throw new Error("TDnet iframe not found");
    }

    const listUrl = TDNET_BASE + iframeSrc;
    console.log(`[Scrape] Fetching list from: ${listUrl}`);

    // 2. リストページを取得
    const resList = await fetch(listUrl, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
    });

    if (!resList.ok) {
        throw new Error(`TDnet list fetch failed: ${resList.status}`);
    }

    const htmlList = await resList.text();
    const $ = cheerio.load(htmlList);
    const items: TdnetItem[] = [];

    // TDnet の各行を解析
    $("tr").each((_, row) => {
        const $row = $(row);
        const cells = $row.find("td");
        // クラス名や構造が変わっている可能性があるので、セル数で簡易チェック
        if (cells.length < 4) return;

        // PDF リンクを探す
        const pdfLink = $row.find('a[href*=".pdf"]');
        if (pdfLink.length === 0) return;

        const href = pdfLink.attr("href") || "";
        const pdfUrl = href.startsWith("http") ? href : TDNET_BASE + href;

        // 証券コードの取得（通常1列目付近）
        const codeText = cells.eq(0).text().trim(); // 列位置が変わる可能性も考慮して調整必要か？
        // 通常のTDnetリスト構造:
        // [0] 時刻 [1] コード [2] 会社名 [3] 表題 [4] XBRL等

        const time = cells.eq(0).text().trim();
        const code = cells.eq(1).text().trim().substring(0, 4); // 4桁コード抽出
        const name = cells.eq(2).text().trim();
        const title = cells.eq(3).text().trim(); // PDFリンクでない場合もあるのでセルから取得

        // 決算短信のみフィルタ（タイトルに「決算短信」を含むもの）
        if (!title.includes("決算短信") && !title.includes("決算")) return;

        // コードが数字でない場合はスキップ（ヘッダー行など）
        if (!/^\d{4}$/.test(code)) return;

        const id = `${code}_${time.replace(/[\s:\/]/g, "")}`;

        items.push({ id, code, name, title, pdfUrl, time });
    });

    return items;
}

// ─── Gemini でPDF分析 ─────────────────────────────────────
async function analyzePdfWithGemini(
    pdfBuffer: ArrayBuffer,
    apiKey: string
): Promise<GeminiAnalysis> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    // PDF を Base64 エンコード
    const uint8 = new Uint8Array(pdfBuffer);
    let binary = "";
    for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
    }
    const base64Pdf = btoa(binary);

    const prompt = `あなたは日本企業の決算短信を分析する財務アナリストです。
以下のPDFは決算短信です。以下の情報を正確に抽出し、JSONのみで回答してください。

必要な情報:
1. 売上高の前年同期比増減率（%）
2. 営業利益（または経常利益）の前年同期比増減率（%）
3. 決算内容の要約（100文字以内、日本語）

回答フォーマット（JSON のみ、他のテキストは不要）:
{
  "sales_pct": <数値 or null>,
  "profit_pct": <数値 or null>,
  "summary": "<要約文>"
}

注意:
- 増加はプラス、減少はマイナスの数値で返してください。
- 数値が読み取れない場合は null としてください。
- JSON以外のテキストは絶対に含めないでください。`;

    const result = await model.generateContent([
        {
            inlineData: {
                mimeType: "application/pdf",
                data: base64Pdf,
            },
        },
        { text: prompt },
    ]);

    const responseText = result.response.text().trim();

    // JSON 部分を抽出（余計なテキストが含まれている場合のフォールバック）
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        console.error("Gemini response is not valid JSON:", responseText);
        return { sales_pct: null, profit_pct: null, summary: "分析に失敗しました" };
    }

    try {
        const parsed = JSON.parse(jsonMatch[0]) as GeminiAnalysis;
        return {
            sales_pct: typeof parsed.sales_pct === "number" ? parsed.sales_pct : null,
            profit_pct:
                typeof parsed.profit_pct === "number" ? parsed.profit_pct : null,
            summary: parsed.summary || "要約なし",
        };
    } catch (e) {
        console.error("JSON parse error:", e, responseText);
        return { sales_pct: null, profit_pct: null, summary: "分析に失敗しました" };
    }
}

// ─── PDF 取得 ─────────────────────────────────────────────
async function fetchPdf(url: string): Promise<ArrayBuffer | null> {
    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                Accept: "application/pdf",
            },
        });
        if (!res.ok) {
            console.error(`PDF fetch failed: ${res.status} for ${url}`);
            return null;
        }
        return await res.arrayBuffer();
    } catch (e) {
        console.error(`PDF fetch error for ${url}:`, e);
        return null;
    }
}

// ─── D1 操作 ──────────────────────────────────────────────
async function getExistingIds(db: D1Database): Promise<Set<string>> {
    const { results } = await db
        .prepare("SELECT id FROM reports ORDER BY created_at DESC LIMIT 500")
        .all<{ id: string }>();
    return new Set((results ?? []).map((r) => r.id));
}

async function insertReport(
    db: D1Database,
    item: TdnetItem,
    analysis: GeminiAnalysis
): Promise<void> {
    const isDoubleGrowth =
        analysis.sales_pct !== null &&
            analysis.profit_pct !== null &&
            analysis.sales_pct > 0 &&
            analysis.profit_pct > 0
            ? 1
            : 0;

    await db
        .prepare(
            `INSERT OR IGNORE INTO reports
       (id, code, name, title, sales_pct, profit_pct, is_double_growth, summary, pdf_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
            item.id,
            item.code,
            item.name,
            item.title,
            analysis.sales_pct,
            analysis.profit_pct,
            isDoubleGrowth,
            analysis.summary,
            item.pdfUrl,
            Date.now()
        )
        .run();
}

// ─── Scheduled Handler（Cron） ────────────────────────────
async function handleScheduled(
    _event: ScheduledEvent,
    env: Bindings,
    ctx: ExecutionContext
): Promise<void> {
    console.log("[Cron] 決算短信スクレイピング開始...");

    try {
        // 1. TDnet をスクレイピング
        const items = await scrapeTdnet();
        console.log(`[Cron] ${items.length} 件の決算短信を検出`);

        if (items.length === 0) return;

        // 2. 既存IDを取得して新規のみフィルタ
        const existingIds = await getExistingIds(env.DB);
        const newItems = items.filter((item) => !existingIds.has(item.id));
        console.log(`[Cron] ${newItems.length} 件が新規`);

        if (newItems.length === 0) return;

        // 3. 各新規アイテムを処理（並列数を制限）
        const CONCURRENCY = 3;
        for (let i = 0; i < newItems.length; i += CONCURRENCY) {
            const batch = newItems.slice(i, i + CONCURRENCY);
            await Promise.all(
                batch.map(async (item) => {
                    try {
                        console.log(`[Cron] 処理中: ${item.code} ${item.name}`);

                        // PDF 取得
                        const pdfBuffer = await fetchPdf(item.pdfUrl);
                        if (!pdfBuffer) {
                            // PDFが取得できない場合はAI分析なしで保存
                            await insertReport(env.DB, item, {
                                sales_pct: null,
                                profit_pct: null,
                                summary: "PDF取得に失敗",
                            });
                            return;
                        }

                        // Gemini で分析
                        const analysis = await analyzePdfWithGemini(
                            pdfBuffer,
                            env.GOOGLE_API_KEY
                        );

                        // D1 に保存
                        await insertReport(env.DB, item, analysis);
                        console.log(
                            `[Cron] 保存完了: ${item.code} ${item.name} (売上:${analysis.sales_pct}% 利益:${analysis.profit_pct}%)`
                        );
                    } catch (e) {
                        console.error(`[Cron] Error processing ${item.code}:`, e);
                    }
                })
            );
        }

        console.log("[Cron] 処理完了");
    } catch (e) {
        console.error("[Cron] Fatal error:", e);
    }
}

// ─── エクスポート ─────────────────────────────────────────
export default {
    fetch: app.fetch,
    scheduled: handleScheduled,
};
