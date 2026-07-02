"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type Venue = "札幌" | "函館" | "福島" | "新潟" | "東京" | "中山" | "中京" | "京都" | "阪神" | "小倉" | "門別" | "その他";
type Surface = "芝" | "ダート";
type Distance = "1000" | "1150" | "1200" | "1400" | "1600" | "1700" | "1800" | "2000" | "2200" | "2400" | "2500" | "2600" | "その他";
type Turn = "右回り" | "左回り" | "直線";
type Layout = "内回り" | "外回り" | "該当なし";
type Straight = "短い" | "普通" | "長い";
type CourseScale = "小回り" | "標準" | "大箱";
type Hill = "坂あり" | "坂なし";
type TrackCondition = "良" | "稍重" | "重" | "不良";
type Cushion = "超高速" | "高速" | "標準" | "低め" | "かなり低い" | "不明";
type Moisture = "乾き気味" | "標準" | "高め" | "かなり高い" | "不明";
type Pace = "スロー" | "ミドル" | "ハイ" | "読めない";
type FieldSize = "少頭数" | "標準" | "多頭数";
type GateBias = "内有利" | "外有利" | "フラット" | "不明";
type StyleBias = "逃げ有利" | "先行有利" | "差し有利" | "追い込み有利" | "フラット" | "不明";
type TrackBias = "内伸び" | "外伸び" | "前残り" | "差し届く" | "時計速い" | "時計かかる" | "荒れ馬場" | "フラット" | "不明";
type RaceNumber = "1R" | "2R" | "3R" | "4R" | "5R" | "6R" | "7R" | "8R" | "9R" | "10R" | "11R" | "12R";

type PatternInput = {
  date: string;
  raceNumber: RaceNumber;
  venue: Venue;
  surface: Surface;
  distance: Distance;
  turn: Turn;
  layout: Layout;
  straightLength: Straight;
  courseScale: CourseScale;
  hill: Hill;
  condition: TrackCondition;
  cushion: Cushion;
  moisture: Moisture;
  pace: Pace;
  fieldSize: FieldSize;
  gateBias: GateBias;
  styleBias: StyleBias;
  trackBias: TrackBias;
  trendMemo: string;
};

type PatternMemo = {
  conclusion: string;
  buyConditions: string;
  avoidConditions: string;
  marketGap: string;
  finalMemo: string;
};

type PatternResult = {
  patternName: string;
  earlyScore: number;
  lateScore: number;
  staminaScore: number;
  mobilityScore: number;
  goingScore: number;
  requiredStyle: string;
  requiredStyleReason: string;
  requiredEarlySpeed: string;
  requiredEarlySpeedReason: string;
  requiredLateSpeed: string;
  requiredLateSpeedReason: string;
  requiredStamina: string;
  requiredStaminaReason: string;
  requiredMobility: string;
  requiredMobilityReason: string;
  requiredGoingFit: string;
  requiredGoingFitReason: string;
  dangerousFavorite: string;
  dangerousFavoriteReason: string;
  targetLongshot: string;
  targetLongshotReason: string;
  skipCondition: string;
  skipConditionReason: string;
  patternConclusion: string;
};

type PatternRecord = PatternInput & PatternMemo & PatternResult & { id: string; createdAt: string; updatedAt?: string };
type HorseRow = { horseName: string; jockey: string; popularity: string; odds: string; memo: string; match?: string };

const storageKey = "phoenix-os-simple-patterns";
const venues: Venue[] = ["札幌", "函館", "福島", "新潟", "東京", "中山", "中京", "京都", "阪神", "小倉", "門別", "その他"];
const distances: Distance[] = ["1000", "1150", "1200", "1400", "1600", "1700", "1800", "2000", "2200", "2400", "2500", "2600", "その他"];
const raceNumbers: RaceNumber[] = ["1R", "2R", "3R", "4R", "5R", "6R", "7R", "8R", "9R", "10R", "11R", "12R"];

const initialInput: PatternInput = {
  date: "",
  raceNumber: "1R",
  venue: "東京",
  surface: "芝",
  distance: "1600",
  turn: "左回り",
  layout: "該当なし",
  straightLength: "長い",
  courseScale: "大箱",
  hill: "坂あり",
  condition: "良",
  cushion: "標準",
  moisture: "標準",
  pace: "ミドル",
  fieldSize: "標準",
  gateBias: "フラット",
  styleBias: "差し有利",
  trackBias: "外伸び",
  trendMemo: "",
};

const initialMemo: PatternMemo = { conclusion: "", buyConditions: "", avoidConditions: "", marketGap: "", finalMemo: "" };

function safeJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function numericDistance(distance: Distance) {
  return distance === "その他" ? 0 : Number(distance);
}

function joinParts(parts: string[]) {
  return parts.filter(Boolean).join("、");
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreText(score: number, high: string, mid: string, low: string) {
  if (score >= 75) return high;
  if (score >= 55) return mid;
  return low;
}

function buildPatternResult(input: PatternInput): PatternResult {
  let earlyScore = 45;
  let lateScore = 45;
  let staminaScore = 45;
  let mobilityScore = 45;
  let goingScore = 45;
  const styleNotes: string[] = [];
  const dangerNotes: string[] = [];
  const targetNotes: string[] = [];
  const skipNotes: string[] = [];

  const add = (scores: Partial<Record<"early" | "late" | "stamina" | "mobility" | "going", number>>, note: string, danger: string, target: string) => {
    earlyScore += scores.early || 0;
    lateScore += scores.late || 0;
    staminaScore += scores.stamina || 0;
    mobilityScore += scores.mobility || 0;
    goingScore += scores.going || 0;
    if (note) styleNotes.push(note);
    if (danger) dangerNotes.push(danger);
    if (target) targetNotes.push(target);
  };

  if (input.courseScale === "小回り") add({ mobility: 22, early: 10 }, "小回りなのでコーナーで加速できる馬", "大外ぶん回しの差し馬", "立ち回りが上手い先行・好位馬");
  if (input.courseScale === "大箱") add({ late: 22, stamina: 10 }, "大箱なので長く脚を使える差し馬", "小回り専用の先行馬", "直線で持続的に伸びる馬");
  if (input.straightLength === "短い") add({ early: 18, mobility: 18 }, "直線が短くテン性能と先行力が重要", "後方一気の馬", "前で運べてコーナーで動ける馬");
  if (input.straightLength === "長い") add({ late: 18, stamina: 16 }, "直線が長く上がり性能と持続力が重要", "早仕掛けで止まる馬", "長く脚を使える差し馬");
  if (input.hill === "坂あり") add({ stamina: 16, going: 10 }, "坂で止まらない持続力とパワーが必要", "軽いスピードだけの馬", "坂で踏ん張れる持続型");
  if (input.hill === "坂なし") add({ early: 10, mobility: 10 }, "坂なしでスピードと機動力を活かしやすい", "パワーだけで切れない馬", "スピードで押し切れる馬");
  if (input.condition === "重" || input.condition === "不良") add({ going: 24, stamina: 18, early: 8 }, "重い馬場で馬場適性とパワーが重要", "良馬場専用の高速上がり馬", "道悪を苦にしないパワー型");
  if (input.cushion === "低め" || input.cushion === "かなり低い") add({ going: 20, stamina: 18 }, "クッション値が低くパワーと持続力が必要", "高速決着専用馬", "時計のかかる馬場で粘れる馬");
  if (input.cushion === "超高速" || input.cushion === "高速") add({ early: 14, late: 14 }, "クッション値が高くスピード性能が必要", "時計のかかる馬場専用馬", "高速決着に対応できる馬");
  if (input.moisture === "高め" || input.moisture === "かなり高い") add({ going: 18, stamina: 14, early: 10 }, "含水率が高く先行力と持続力が必要", "切れ味だけの差し馬", "前で我慢できるパワー型");
  if (input.pace === "スロー") add({ early: 18, late: 12, mobility: 8 }, "スロー想定で位置取りと瞬発力が重要", "後方待機馬", "好位で脚を溜められる馬");
  if (input.pace === "ハイ") add({ stamina: 20, late: 16 }, "ハイ想定で消耗戦適性と差し脚が重要", "前だけで押し切る馬", "持続的に差せる馬");
  if (input.gateBias === "内有利") add({ early: 10, mobility: 12 }, "内有利で内枠先行馬を評価", "外枠差し馬", "内でロスなく運べる馬");
  if (input.gateBias === "外有利") add({ late: 12, stamina: 8 }, "外有利で外差しや外を回せる馬を評価", "内で揉まれる人気馬", "外に出せる差し馬");
  if (input.styleBias === "逃げ有利" || input.styleBias === "先行有利") add({ early: 22, mobility: 14 }, "逃げ・先行有利でテン性能と機動力が重要", "差し追い込み馬", "先行力のある馬");
  if (input.styleBias === "差し有利" || input.styleBias === "追い込み有利") add({ late: 22, stamina: 14 }, "差し・追い込み有利で上がり性能と持続力が重要", "人気の逃げ先行馬", "上がりを使える差し馬");
  if (input.trackBias === "前残り") add({ early: 22, mobility: 8 }, "前残り馬場でテン性能と先行力が重要", "後方勢", "前で運べる馬");
  if (input.trackBias === "差し届く" || input.trackBias === "外伸び") add({ late: 22, stamina: 14 }, "差し届く/外伸びで上がり性能と外差し適性が重要", "内先行の人気馬", "外から長く脚を使える馬");
  if (input.trackBias === "時計速い") add({ early: 14, late: 16 }, "時計が速くスピードと上がり性能が重要", "時計のかかる馬場専用馬", "高速馬場でスピードを出せる馬");
  if (input.trackBias === "時計かかる" || input.trackBias === "荒れ馬場") add({ going: 22, stamina: 18 }, "時計がかかる/荒れ馬場でパワーと馬場適性が重要", "軽いスピード馬", "パワーと持続力のある馬");

  const distance = numericDistance(input.distance);
  if (distance && distance <= 1400) add({ early: 12 }, "短距離でテン性能が必要", "追走に苦労する馬", "前半から流れに乗れる馬");
  if (distance >= 1800) add({ stamina: 10 }, "中長距離で持続力が必要", "距離に不安のある馬", "距離ロスを抑えて長く脚を使える馬");

  earlyScore = clampScore(earlyScore);
  lateScore = clampScore(lateScore);
  staminaScore = clampScore(staminaScore);
  mobilityScore = clampScore(mobilityScore);
  goingScore = clampScore(goingScore);

  const maxScore = Math.max(earlyScore, lateScore, staminaScore, mobilityScore, goingScore);
  let patternName = "バランス型";
  if (input.gateBias === "不明" && input.styleBias === "不明" && input.trackBias === "不明" && input.pace === "読めない") patternName = "見送り型";
  else if (input.trackBias === "前残り" || earlyScore === maxScore) patternName = input.courseScale === "小回り" ? "小回り前残り機動力型" : "前残りテン性能型";
  else if ((input.trackBias === "外伸び" || input.trackBias === "差し届く") && staminaScore >= 65) patternName = "外差し持続型";
  else if (goingScore === maxScore && (input.condition === "重" || input.condition === "不良" || input.trackBias === "荒れ馬場")) patternName = "重馬場パワー型";
  else if (lateScore === maxScore && (input.trackBias === "時計速い" || input.cushion === "高速" || input.cushion === "超高速")) patternName = "高速上がり型";
  else if (mobilityScore === maxScore) patternName = "小回り先行機動力型";
  else if (staminaScore === maxScore) patternName = "外差し持続型";

  const requiredStyle = styleNotes.length ? joinParts([...new Set(styleNotes)].slice(0, 4)) : "極端な脚質より、馬場と枠に合わせて運べる馬";
  const requiredEarlySpeed = scoreText(earlyScore, "テン性能は最重要。スタート後に好位を取れる馬", "標準以上の位置取り性能が必要", "テン性能は必須ではない。脚を溜められる馬でも可");
  const requiredLateSpeed = scoreText(lateScore, "上がり性能は最重要。速い脚または長く脚を使えること", "標準以上の上がり性能が必要", "上がりより立ち回り・位置取りを優先");
  const requiredStamina = scoreText(staminaScore, "持続力は最重要。早めに動いても止まらない馬", "標準以上の持続力が必要", "持続力より一瞬の速さや位置取りを優先");
  const requiredMobility = scoreText(mobilityScore, "機動力は最重要。コーナーで加速し位置を取れる馬", "標準以上の機動力が必要", "機動力より直線性能を重視");
  const requiredGoingFit = scoreText(goingScore, "馬場適性は最重要。パワーや道悪対応が必要", "標準以上の馬場対応力が必要", "馬場適性よりスピード・展開を重視");
  const dangerousFavorite = joinParts([...new Set(dangerNotes)].slice(0, 5)) || "選択条件に合わない過剰人気馬";
  const targetLongshot = joinParts([...new Set(targetNotes)].slice(0, 5)) || "条件に合うのに近走着順で嫌われた馬";
  const skipCondition = joinParts([...(skipNotes.length ? skipNotes : []), input.pace === "読めない" ? "ペースが読めず型を絞れない" : "想定ペースと馬場傾向が矛盾する", input.gateBias === "不明" && input.styleBias === "不明" && input.trackBias === "不明" ? "バイアスが全く読めない" : "型に合う馬を言語化できない"]);
  const topReason = (items: string[], fallback: string) => [...new Set(items)].slice(0, 2).join("、") || fallback;
  const requiredStyleReason = topReason(styleNotes, "選択条件から脚質の優位性がまだ強く出ていないため");
  const requiredEarlySpeedReason = earlyScore >= 70 ? "前残り・短い直線・短距離・先行有利の条件が重なっているため" : earlyScore >= 55 ? "一定の位置取り性能が必要な条件があるため" : "テンよりも直線性能や持続力を重視する条件のため";
  const requiredLateSpeedReason = lateScore >= 70 ? "大箱・長い直線・差し有利・高速馬場の条件が重なっているため" : lateScore >= 55 ? "直線で伸びる性能が必要な条件があるため" : "上がりだけでは届きにくい条件のため";
  const requiredStaminaReason = staminaScore >= 70 ? "ハイペース・坂・道悪・時計のかかる馬場で消耗戦になりやすいため" : staminaScore >= 55 ? "最後まで脚を使う持続力が必要な条件があるため" : "持続力より位置取りや瞬発力を優先する条件のため";
  const requiredMobilityReason = mobilityScore >= 70 ? "小回り・直線短い・内有利・前残りでコーナーの立ち回りが重要なため" : mobilityScore >= 55 ? "ロスなく動ける機動力が必要な条件があるため" : "機動力より直線性能や馬場適性を重視する条件のため";
  const requiredGoingFitReason = goingScore >= 70 ? "重不良・低いクッション値・高い含水率・荒れ馬場で馬場適性の差が出やすいため" : goingScore >= 55 ? "今の馬場を苦にしない対応力が必要なため" : "馬場適性より展開やスピードを重視する条件のため";
  const dangerousFavoriteReason = topReason(dangerNotes, "人気ではなく、今回の型に合うかを優先して判断するため");
  const targetLongshotReason = topReason(targetNotes, "近走着順より、今回条件との一致を評価できるため");
  const skipConditionReason = patternName === "見送り型" ? "ペースやバイアスが読めず、型の再現性を検証しにくいため" : "買う根拠を言語化できない時点で、Phoenix OSの勝負条件から外れるため";
  const patternConclusion = patternName === "見送り型"
    ? "このレースは「見送り型」。条件の不明点が多く、勝ち馬像を絞り切れない。無理に買わず、結果を見て型の材料を集めるレース。"
    : "このレースは「" + patternName + "」。狙うべきは、" + targetLongshot + "。必要な脚質は「" + requiredStyle + "」。" + dangerousFavorite + "は危険。";

  return { patternName, earlyScore, lateScore, staminaScore, mobilityScore, goingScore, requiredStyle, requiredStyleReason, requiredEarlySpeed, requiredEarlySpeedReason, requiredLateSpeed, requiredLateSpeedReason, requiredStamina, requiredStaminaReason, requiredMobility, requiredMobilityReason, requiredGoingFit, requiredGoingFitReason, dangerousFavorite, dangerousFavoriteReason, targetLongshot, targetLongshotReason, skipCondition, skipConditionReason, patternConclusion };
}

function parseHorseCsv(text: string): HorseRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((header) => header.trim());
  const pick = (row: string[], names: string[]) => {
    const index = headers.findIndex((header) => names.includes(header));
    return index >= 0 ? row[index] || "" : "";
  };
  return lines.slice(1).map((line) => {
    const row = line.split(",").map((cell) => cell.trim());
    return { horseName: pick(row, ["馬名", "horseName"]), jockey: pick(row, ["騎手", "jockey"]), popularity: pick(row, ["人気", "popularity"]), odds: pick(row, ["オッズ", "odds"]), memo: pick(row, ["メモ", "memo", "前走"]) };
  }).filter((horse) => horse.horseName);
}

export default function Home() {
  const [patterns, setPatterns] = useState<PatternRecord[]>([]);
  const [input, setInput] = useState<PatternInput>(initialInput);
  const [memo, setMemo] = useState<PatternMemo>(initialMemo);
  const [query, setQuery] = useState("");
  const [surfaceFilter, setSurfaceFilter] = useState<"すべて" | Surface>("すべて");
  const [conditionFilter, setConditionFilter] = useState<"すべて" | TrackCondition>("すべて");
  const [csvRows, setCsvRows] = useState<HorseRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { setPatterns(safeJson<PatternRecord[]>(window.localStorage.getItem(storageKey), [])); }, []);
  useEffect(() => { window.localStorage.setItem(storageKey, JSON.stringify(patterns)); }, [patterns]);

  const result = useMemo(() => buildPatternResult(input), [input]);
  const filteredPatterns = useMemo(() => patterns.filter((pattern) => {
    const normalizedQuery = query.trim().toLowerCase();
    const searchableText = [
      pattern.date,
      pattern.raceNumber,
      pattern.patternName,
      pattern.venue,
      pattern.distance,
      pattern.surface,
      pattern.condition,
      pattern.pace,
      pattern.trackBias,
      pattern.trendMemo,
      pattern.conclusion,
      pattern.buyConditions,
      pattern.avoidConditions,
      pattern.marketGap,
      pattern.finalMemo,
      pattern.patternConclusion,
    ].filter(Boolean).join(" ").toLowerCase();
    return (!normalizedQuery || searchableText.includes(normalizedQuery)) && (surfaceFilter === "すべて" || pattern.surface === surfaceFilter) && (conditionFilter === "すべて" || pattern.condition === conditionFilter);
  }), [patterns, query, surfaceFilter, conditionFilter]);

  const candidateRows = useMemo(() => {
    const targetText = [result.requiredStyle, result.requiredGoingFit, memo.buyConditions, memo.marketGap].join(" ");
    return csvRows.map((row) => {
      const source = [row.horseName, row.memo].join(" ");
      const match = targetText.split(/[、。\s]+/).filter((word) => word.length >= 2 && source.includes(word));
      return { ...row, match: match.slice(0, 4).join(" / ") || "参考材料なし" };
    });
  }, [csvRows, result, memo]);

  function updateInput<K extends keyof PatternInput>(key: K, value: PatternInput[K]) { setInput((current) => ({ ...current, [key]: value })); }
  function updateMemo<K extends keyof PatternMemo>(key: K, value: PatternMemo[K]) { setMemo((current) => ({ ...current, [key]: value })); }
  function savePattern(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const now = new Date().toISOString();
    if (editingId) {
      setPatterns((current) => current.map((pattern) => pattern.id === editingId ? { ...pattern, ...input, ...memo, ...result, updatedAt: now } : pattern));
      cancelEdit();
      return;
    }
    const record: PatternRecord = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...input, ...memo, ...result };
    setPatterns((current) => [record, ...current]);
  }
  function startEdit(pattern: PatternRecord) {
    setEditingId(pattern.id);
    setInput({ date: pattern.date || "", raceNumber: pattern.raceNumber || "1R", venue: pattern.venue, surface: pattern.surface, distance: pattern.distance, turn: pattern.turn, layout: pattern.layout, straightLength: pattern.straightLength, courseScale: pattern.courseScale, hill: pattern.hill, condition: pattern.condition, cushion: pattern.cushion, moisture: pattern.moisture, pace: pattern.pace, fieldSize: pattern.fieldSize, gateBias: pattern.gateBias, styleBias: pattern.styleBias, trackBias: pattern.trackBias, trendMemo: pattern.trendMemo || "" });
    setMemo({ conclusion: pattern.conclusion || "", buyConditions: pattern.buyConditions || "", avoidConditions: pattern.avoidConditions || "", marketGap: pattern.marketGap || "", finalMemo: pattern.finalMemo || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelEdit() {
    setEditingId(null);
    setInput(initialInput);
    setMemo(initialMemo);
  }
  function formatDate(value?: string) {
    if (!value) return "未記録";
    return new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  }
  function formatRaceDate(value?: string) {
    if (!value) return "日付未設定";
    return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
  }
  function deletePattern(patternId: string) {
    if (!window.confirm("本当に削除しますか？")) return;
    setPatterns((current) => current.filter((pattern) => pattern.id !== patternId));
    if (editingId === patternId) cancelEdit();
  }
  function handleCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvRows(parseHorseCsv(String(reader.result || "")));
    reader.readAsText(file, "utf-8");
  }

  return (
    <main className="shell">
      <section className="heroSimple"><p className="eyebrow">Phoenix OS Simple</p><h1>選んで、型を作る。</h1><p>予想を自動化せず、レース条件と馬場傾向から勝ち馬に求められる特徴を言語化します。</p></section>
      <form className="mainGrid" onSubmit={savePattern}>
        <section className="panel formPanel"><div className="panelHeader"><div><p className="eyebrow">{editingId ? "Update Mode" : "Pattern Builder"}</p><h2>{editingId ? "更新モード" : "型作成画面"}</h2></div><div className="formActions"><button type="submit">{editingId ? "型を更新" : "型を保存"}</button>{editingId && <button type="button" className="quietButton" onClick={cancelEdit}>キャンセル</button>}</div></div>
          <div className="formGrid">
            <label>日付<input type="date" value={input.date} onChange={(event) => updateInput("date", event.target.value)} /></label>
            <SelectField label="レース番号" value={input.raceNumber} options={raceNumbers} onChange={(value) => updateInput("raceNumber", value as RaceNumber)} />
            <SelectField label="競馬場" value={input.venue} options={venues} onChange={(value) => updateInput("venue", value as Venue)} />
            <SelectField label="芝/ダート" value={input.surface} options={["芝", "ダート"]} onChange={(value) => updateInput("surface", value as Surface)} />
            <SelectField label="距離" value={input.distance} options={distances} onChange={(value) => updateInput("distance", value as Distance)} />
            <SelectField label="右回り/左回り" value={input.turn} options={["右回り", "左回り", "直線"]} onChange={(value) => updateInput("turn", value as Turn)} />
            <SelectField label="内回り/外回り" value={input.layout} options={["内回り", "外回り", "該当なし"]} onChange={(value) => updateInput("layout", value as Layout)} />
            <SelectField label="直線の長さ" value={input.straightLength} options={["短い", "普通", "長い"]} onChange={(value) => updateInput("straightLength", value as Straight)} />
            <SelectField label="コース形態" value={input.courseScale} options={["小回り", "標準", "大箱"]} onChange={(value) => updateInput("courseScale", value as CourseScale)} />
            <SelectField label="坂" value={input.hill} options={["坂あり", "坂なし"]} onChange={(value) => updateInput("hill", value as Hill)} />
            <SelectField label="馬場状態" value={input.condition} options={["良", "稍重", "重", "不良"]} onChange={(value) => updateInput("condition", value as TrackCondition)} />
            <SelectField label="クッション値" value={input.cushion} options={["超高速", "高速", "標準", "低め", "かなり低い", "不明"]} onChange={(value) => updateInput("cushion", value as Cushion)} />
            <SelectField label="含水率" value={input.moisture} options={["乾き気味", "標準", "高め", "かなり高い", "不明"]} onChange={(value) => updateInput("moisture", value as Moisture)} />
            <SelectField label="想定ペース" value={input.pace} options={["スロー", "ミドル", "ハイ", "読めない"]} onChange={(value) => updateInput("pace", value as Pace)} />
            <SelectField label="頭数" value={input.fieldSize} options={["少頭数", "標準", "多頭数"]} onChange={(value) => updateInput("fieldSize", value as FieldSize)} />
            <SelectField label="枠バイアス" value={input.gateBias} options={["内有利", "外有利", "フラット", "不明"]} onChange={(value) => updateInput("gateBias", value as GateBias)} />
            <SelectField label="脚質バイアス" value={input.styleBias} options={["逃げ有利", "先行有利", "差し有利", "追い込み有利", "フラット", "不明"]} onChange={(value) => updateInput("styleBias", value as StyleBias)} />
            <SelectField label="当日のトラックバイアス" value={input.trackBias} options={["内伸び", "外伸び", "前残り", "差し届く", "時計速い", "時計かかる", "荒れ馬場", "フラット", "不明"]} onChange={(value) => updateInput("trackBias", value as TrackBias)} />
            <label className="wide">過去レース傾向メモ<textarea value={input.trendMemo} onChange={(event) => updateInput("trendMemo", event.target.value)} rows={4} /></label>
          </div>
        </section>
        <aside className="panel resultPanel"><p className="eyebrow">Pattern Result</p><h2>型判定結果</h2><div className="patternNameBox"><span>総合的な型名</span><strong>{result.patternName}</strong></div><div className="conclusionBox"><span>型の結論</span><p>{result.patternConclusion}</p></div><div className="scoreGrid"><ScoreItem label="テン" value={result.earlyScore} /><ScoreItem label="上がり" value={result.lateScore} /><ScoreItem label="持続" value={result.staminaScore} /><ScoreItem label="機動力" value={result.mobilityScore} /><ScoreItem label="馬場適性" value={result.goingScore} /></div><ResultItem title="必要な脚質" text={result.requiredStyle} reason={result.requiredStyleReason} /><ResultItem title="必要なテン性能" text={result.requiredEarlySpeed} reason={result.requiredEarlySpeedReason} /><ResultItem title="必要な上がり性能" text={result.requiredLateSpeed} reason={result.requiredLateSpeedReason} /><ResultItem title="必要な持続力" text={result.requiredStamina} reason={result.requiredStaminaReason} /><ResultItem title="必要な機動力" text={result.requiredMobility} reason={result.requiredMobilityReason} /><ResultItem title="必要な馬場適性" text={result.requiredGoingFit} reason={result.requiredGoingFitReason} /><ResultItem title="危険な人気馬の特徴" text={result.dangerousFavorite} reason={result.dangerousFavoriteReason} /><ResultItem title="狙いたい穴馬の特徴" text={result.targetLongshot} reason={result.targetLongshotReason} /><ResultItem title="見送り条件" text={result.skipCondition} reason={result.skipConditionReason} /></aside>
        <section className="panel memoPanel"><p className="eyebrow">Pattern Notes</p><h2>型メモ</h2><div className="memoGrid"><label>このレースの結論<textarea value={memo.conclusion} onChange={(event) => updateMemo("conclusion", event.target.value)} rows={3} /></label><label>買いたい馬の条件<textarea value={memo.buyConditions} onChange={(event) => updateMemo("buyConditions", event.target.value)} rows={3} /></label><label>買わない馬の条件<textarea value={memo.avoidConditions} onChange={(event) => updateMemo("avoidConditions", event.target.value)} rows={3} /></label><label>世の中とズレているポイント<textarea value={memo.marketGap} onChange={(event) => updateMemo("marketGap", event.target.value)} rows={3} /></label><label className="wide">最終判断メモ<textarea value={memo.finalMemo} onChange={(event) => updateMemo("finalMemo", event.target.value)} rows={4} /></label></div></section>
      </form>
      <section className="panel listPanel"><div className="panelHeader"><div><p className="eyebrow">Pattern Archive</p><h2>型一覧</h2></div><span className="badge">{filteredPatterns.length}件</span></div><div className="filters"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="日付、レース番号、型名、競馬場、メモで検索" /><select value={surfaceFilter} onChange={(event) => setSurfaceFilter(event.target.value as "すべて" | Surface)}><option>すべて</option><option>芝</option><option>ダート</option></select><select value={conditionFilter} onChange={(event) => setConditionFilter(event.target.value as "すべて" | TrackCondition)}><option>すべて</option><option>良</option><option>稍重</option><option>重</option><option>不良</option></select></div><div className="patternList">{filteredPatterns.map((pattern) => <article key={pattern.id}><div><strong>{formatRaceDate(pattern.date)} {pattern.raceNumber || "R未設定"} / {pattern.venue} {pattern.surface}{pattern.distance}m</strong><span>{pattern.patternName} / {pattern.condition} / {pattern.pace} / {pattern.trackBias}</span><span>更新: {formatDate(pattern.updatedAt || pattern.createdAt)}</span></div><p>{pattern.requiredStyle}</p><div className="rowActions"><button type="button" className="textButton" onClick={() => startEdit(pattern)}>編集</button><button type="button" className="textButton dangerButton" onClick={() => deletePattern(pattern.id)}>削除</button></div></article>)}{!filteredPatterns.length && <p className="empty">まだ型がありません。</p>}</div></section>
      <section className="panel subPanel"><details><summary>補助機能: CSVを読み込んで参考馬を表示</summary><div className="csvBox"><input type="file" accept=".csv,text/csv" onChange={handleCsv} /><p>CSVは補助機能です。読み込めた場合のみ、型に合う可能性のある馬を参考表示します。</p></div><div className="candidateList">{candidateRows.map((row) => <article key={row.horseName}><strong>{row.horseName}</strong><span>{row.jockey} / {row.popularity}人気 / {row.odds}倍</span><p>{row.match}</p></article>)}</div></details></section>
    </main>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function ScoreItem({ label, value }: { label: string; value: number }) {
  return <article className="scoreItem"><span>{label}</span><strong>{value}</strong></article>;
}

function ResultItem({ title, text, reason }: { title: string; text: string; reason?: string }) {
  return <article className="resultItem"><span>{title}</span><p>{text}</p>{reason && <small>理由: {reason}</small>}</article>;
}
