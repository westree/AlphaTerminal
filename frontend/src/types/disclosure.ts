export type Disclosure = {
    id: string;
    time: string; // 表示用時刻（例: "15:30"）
    code: string; // 銘柄コード
    companyName: string;
    title: string;
    url: string; // PDFへのリンク

    // AI分析結果（バックエンドから付与される想定）
    aiStatus: "pending" | "done" | "error";
    importance: "high" | "medium" | "low";
    sentiment: "positive" | "neutral" | "negative";
    summary: string; // AIによる3行要約
    tags: string[]; // 例: ["決算短信", "上方修正", "自社株買い"]
};
