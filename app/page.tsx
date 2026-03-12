"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import AuthForm from "@/components/auth-form";
import { User } from "@supabase/supabase-js";
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, 
  startOfWeek, endOfWeek, addMonths, subMonths, addDays, subDays, startOfDay, endOfDay, subMonths as dateSubMonths
} from "date-fns";
import { ja } from "date-fns/locale";

// UI部品
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChevronLeft, ChevronRight, Trash2, Bookmark, Plus, Sparkles, Clock, Zap, Timer, AlertCircle, BarChart3, PieChart as PieIcon, LayoutDashboard, Bell, History } from "lucide-react";

declare global {
  interface Window {
    lastNotifiedTask: string;
  }
}

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState("day");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js');
      });
    }
    return () => subscription.unsubscribe();
  }, []);

  const requestPermission = async () => {
    if (!("Notification" in window)) {
      alert("このブラウザは通知に対応していません。");
      return;
    }
    if (Notification.permission === "denied") {
      alert("通知が拒否されています。ブラウザ設定から許可してください。");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      new Notification("Arata Log", { body: "通知が有効になりました！予定時刻にお知らせします。", icon: "/icon-192x192.png" });
    }
  };

  if (!mounted) return null;
  if (loading) return <div className="flex justify-center items-center min-h-screen bg-slate-50 font-black text-slate-400 tracking-[0.2em] animate-pulse">BOOTING...</div>;
  if (!user) return <AuthForm />;

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-10 font-sans text-slate-900 selection:bg-indigo-100">
      <nav className="flex justify-between items-center px-4 md:px-8 h-16 md:h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-1 rounded-lg shadow-lg shadow-indigo-200">
            <LayoutDashboard className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </div>
          <span className="font-black text-slate-800 tracking-tighter text-lg md:text-2xl uppercase">Arata<span className="text-indigo-600">Log</span></span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={requestPermission} className="rounded-full text-slate-400 hover:text-indigo-600" aria-label="通知を許可する">
            <Bell className="w-4 h-4 md:w-5 md:h-5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()} className="rounded-full border-slate-200 text-xs font-bold hover:bg-red-50 hover:text-red-600 transition-all">OUT</Button>
        </div>
      </nav>

      <main className="p-3 md:p-6 max-w-6xl mx-auto space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-slate-200/50 border-none h-14 md:h-16 p-1 rounded-2xl md:rounded-[2rem]">
            <TabsTrigger value="day" className="font-black text-[10px] md:text-xs uppercase data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl md:rounded-[1.5rem] transition-all tracking-tighter">Day</TabsTrigger>
            <TabsTrigger value="month" className="font-black text-[10px] md:text-xs uppercase data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl md:rounded-[1.5rem] transition-all tracking-tighter">Month</TabsTrigger>
            <TabsTrigger value="template" className="font-black text-[10px] md:text-xs uppercase data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl md:rounded-[1.5rem] transition-all tracking-tighter">Routine</TabsTrigger>
          </TabsList>

          <TabsContent value="day" className="space-y-6 outline-none animate-in fade-in slide-in-from-bottom-2">
            <TodoDayView userId={user.id} date={currentDate} setDate={setCurrentDate} />
          </TabsContent>

          <TabsContent value="month" className="space-y-8 outline-none animate-in fade-in slide-in-from-bottom-2">
            <TodoMonthView userId={user.id} viewDate={currentDate} setViewDate={setCurrentDate} setTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="template" className="outline-none animate-in fade-in slide-in-from-bottom-2">
            <TodoTemplateView userId={user.id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// --- 1. 1日の詳細ビュー ---
function TodoDayView({ userId, date, setDate }: { userId: string, date: Date, setDate: any }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [allPastTasks, setAllPastTasks] = useState<string[]>([]); // 履歴用
  const [templates, setTemplates] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  const fetchData = async () => {
    const start = startOfDay(date); const end = endOfDay(date);
    const { data: tasksData } = await supabase.from("tasks").select("*").eq("user_id", userId)
      .gte("created_at", start.toISOString()).lte("created_at", end.toISOString()).order("scheduled_start", { ascending: true });
    setTasks(tasksData || []);

    const { data: historyData } = await supabase.from("tasks").select("title").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
    if (historyData) {
      const uniqueTitles = Array.from(new Set(historyData.map(t => t.title))).slice(0, 8);
      setAllPastTasks(uniqueTitles);
    }

    const { data: tmplData } = await supabase.from("task_templates").select("*").eq("user_id", userId);
    setTemplates(tmplData || []);
  };

  useEffect(() => { fetchData(); }, [userId, date]);

  useEffect(() => {
    const checkTasks = () => {
      const now = new Date();
      const currentTime = format(now, "HH:mm");
      tasks.forEach(task => {
        if (isSameDay(new Date(), date) && !task.is_completed && task.scheduled_start === currentTime) {
          const notificationKey = `${task.id}-${currentTime}`;
          if (window.lastNotifiedTask !== notificationKey) {
            if (Notification.permission === "granted") {
              new Notification("Arata Log", { body: `ミッション開始：${task.title}の時間です！`, icon: "/icon-192x192.png" });
              window.lastNotifiedTask = notificationKey;
            }
          }
        }
      });
    };
    const interval = setInterval(checkTasks, 30000);
    return () => clearInterval(interval);
  }, [tasks, date]);

  const timeBoxingData = useMemo(() => {
    if (tasks.length === 0) return [{ value: 1440, color: "#F1F5F9", isTask: false }];
    const points = new Set([0, 1440]);
    tasks.forEach(t => {
      const [sh, sm] = t.scheduled_start.split(":").map(Number);
      const [eh, em] = t.scheduled_end.split(":").map(Number);
      points.add(sh * 60 + sm); points.add(eh * 60 + em);
    });
    const sortedPoints = Array.from(points).sort((a, b) => a - b);
    const segments = [];
    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const start = sortedPoints[i]; const end = sortedPoints[i+1]; const mid = (start + end) / 2;
      const overlappingTasks = tasks.filter(t => {
        const [sh, sm] = t.scheduled_start.split(":").map(Number);
        const [eh, em] = t.scheduled_end.split(":").map(Number);
        return mid >= (sh * 60 + sm) && mid <= (eh * 60 + em);
      });
      const timeStr = `${Math.floor(start/60)}:${(start%60).toString().padStart(2,'0')}-${Math.floor(end/60)}:${(end%60).toString().padStart(2,'0')}`;
      if (overlappingTasks.length === 0) {
        segments.push({ value: end - start, color: "#F8FAFC", isTask: false, time: timeStr });
      } else if (overlappingTasks.length === 1) {
        const t = overlappingTasks[0];
        segments.push({ name: t.title, value: end - start, color: t.is_completed ? "#4F46E5" : "#A5B4FC", isTask: true, time: timeStr, isOverlap: false });
      } else {
        segments.push({ name: "重複", value: end - start, color: "#F43F5E", isTask: true, time: timeStr, isOverlap: true, taskNames: overlappingTasks.map(ot => ot.title).join(", ") });
      }
    }
    return segments;
  }, [tasks]);

  const addTask = async (t = newTitle, s = startTime, e = endTime) => {
    if (!t) return;
    await supabase.from("tasks").insert([{ title: t, scheduled_start: s, scheduled_end: e, user_id: userId, created_at: date.toISOString() }]);
    setNewTitle(""); fetchData();
  };

  const totalMinutes = tasks.filter(t => t.is_completed).reduce((acc, t) => {
    const [sh, sm] = t.scheduled_start.split(":").map(Number);
    const [eh, em] = t.scheduled_end.split(":").map(Number);
    return acc + ((eh * 60 + em) - (sh * 60 + sm));
  }, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
      <div className="lg:col-span-7 space-y-6">
        <div className="flex items-center justify-between bg-white p-2 rounded-2xl md:rounded-[2rem] shadow-xl shadow-slate-200/50 h-16 md:h-20 px-3 md:px-6">
          <Button variant="ghost" className="h-10 w-10 md:h-14 md:w-14 rounded-full" onClick={() => setDate(subDays(date, 1))} aria-label="前の日"><ChevronLeft /></Button>
          <div className="text-center leading-tight">
            <span className="font-black text-base md:text-2xl text-slate-800 tracking-tighter">{format(date, "M月d日", { locale: ja })}</span>
            <span className="block text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(date, "eeee", { locale: ja })}</span>
          </div>
          <Button variant="ghost" className="h-10 w-10 md:h-14 md:w-14 rounded-full" onClick={() => setDate(addDays(date, 1))} aria-label="次の日"><ChevronRight /></Button>
        </div>

        <div className="p-4 md:p-8 bg-indigo-600 rounded-3xl md:rounded-[3rem] shadow-2xl shadow-indigo-200 space-y-4 md:space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-[9px] md:text-[10px] font-black text-indigo-100 uppercase tracking-widest flex items-center"><Zap className="w-3 h-3 mr-2" /> Routine Deck</p>
            {templates.length > 0 && <Button onClick={async () => {
              await supabase.from("tasks").insert(templates.map(tmp => ({ title: tmp.title, scheduled_start: tmp.scheduled_start, scheduled_end: tmp.scheduled_end, user_id: userId, created_at: date.toISOString() })));
              fetchData();
            }} size="sm" className="bg-white text-indigo-600 font-black text-[9px] h-7 rounded-full px-4 shadow-lg uppercase">Apply All</Button>}
          </div>
          <div className="flex flex-wrap gap-2">
            {templates.map(tmpl => <button key={tmpl.id} onClick={() => addTask(tmpl.title, tmpl.scheduled_start, tmpl.scheduled_end)} className="bg-indigo-500/50 border border-indigo-400/30 text-white px-3 py-2 rounded-xl font-black text-[10px] active:scale-95 transition-all flex items-center"><Plus className="w-3 h-3 inline mr-1" /> {tmpl.title}</button>)}
          </div>
        </div>

        <Card className="rounded-3xl border-none shadow-xl shadow-slate-200/60 overflow-hidden bg-white/70">
          <CardContent className="p-4 md:p-6 space-y-4">
            <div className="space-y-4">
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Task name..." className="h-12 md:h-14 text-base rounded-2xl border-none bg-slate-100/50 px-4 md:px-6 font-medium" aria-label="タスク名" />
              
              {/* 履歴表示セクション（復活！） */}
              {allPastTasks.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1 animate-in fade-in duration-500">
                  <p className="w-full text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center mb-1"><History className="w-2.5 h-2.5 mr-1" /> Recent History</p>
                  {allPastTasks.map((prev, idx) => (
                    <button key={idx} onClick={() => setNewTitle(prev)} className="text-[10px] font-bold px-3 py-1.5 bg-slate-100 text-slate-500 rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-colors border-none">{prev}</button>
                  ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex gap-2 flex-1">
                  <Input type="time" className="h-12 md:h-14 flex-1 rounded-2xl border-none bg-slate-100/50 px-4 font-bold text-center" value={startTime} onChange={(e) => setStartTime(e.target.value)} aria-label="開始" />
                  <Input type="time" className="h-12 md:h-14 flex-1 rounded-2xl border-none bg-slate-100/50 px-4 font-bold text-center" value={endTime} onChange={(e) => setEndTime(e.target.value)} aria-label="終了" />
                </div>
                <Button onClick={() => addTask()} className="h-12 md:h-14 px-8 bg-indigo-600 text-white font-black rounded-2xl shadow-lg uppercase text-xs">Add</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {tasks.map(t => (
            <div key={t.id} className="group flex flex-col md:flex-row md:items-center p-4 md:p-6 bg-white border-none rounded-[2rem] shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center flex-1">
                <Checkbox checked={t.is_completed} className="w-6 h-6 rounded-lg border-slate-200" onCheckedChange={async () => { await supabase.from("tasks").update({ is_completed: !t.is_completed }).eq("id", t.id); fetchData(); }} aria-label="完了" />
                <div className="ml-4 flex-1"><p className={`font-black text-sm md:text-lg ${t.is_completed ? "line-through text-slate-300" : "text-slate-700"}`}>{t.title}</p></div>
              </div>
              <div className="flex items-center justify-between mt-3 md:mt-0 md:ml-6 gap-3">
                <div className="flex items-center gap-1 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <input type="time" value={t.scheduled_start.slice(0, 5)} onChange={async (e) => { await supabase.from("tasks").update({ scheduled_start: e.target.value }).eq("id", t.id); fetchData(); }} className="bg-transparent text-[10px] font-black text-indigo-500 w-14 text-center focus:outline-none" aria-label="開始編集" />
                  <span className="text-slate-300 text-[10px]">-</span>
                  <input type="time" value={t.scheduled_end.slice(0, 5)} onChange={async (e) => { await supabase.from("tasks").update({ scheduled_end: e.target.value }).eq("id", t.id); fetchData(); }} className="bg-transparent text-[10px] font-black text-indigo-500 w-14 text-center focus:outline-none" aria-label="終了編集" />
                </div>
                <Button variant="ghost" size="icon" className="text-slate-200 hover:text-red-500 rounded-xl" onClick={async () => { await supabase.from("tasks").delete().eq("id", t.id); fetchData(); }} aria-label="削除"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-5">
        <Card className="rounded-[2.5rem] md:rounded-[3.5rem] bg-white border-none shadow-2xl shadow-slate-200/80 p-6 md:p-8">
          <CardHeader className="p-0 mb-6 text-center">
            <CardTitle className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center italic"><Timer className="w-4 h-4 mr-2 text-indigo-500" /> Time Box Chart</CardTitle>
          </CardHeader>
          <div className="h-64 md:h-80 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={timeBoxingData} innerRadius="70%" outerRadius="100%" dataKey="value" stroke="none" startAngle={90} endAngle={-270} labelLine={false}
                  label={(props: any) => {
                    const { cx, cy, midAngle, innerRadius, outerRadius, value, payload } = props;
                    if (!payload?.isTask || value < 45 || midAngle === undefined) return null;
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-[8px] font-black pointer-events-none">{payload.time.split('-')[0]}</text>;
                  }}
                >
                  {timeBoxingData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <RechartsTooltip content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload; if (!d?.isTask) return null;
                    return <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl shadow-2xl text-white font-black text-[10px]"><p>{d.isOverlap ? d.taskNames : d.name}</p><p className="text-slate-400 mt-1">{d.time}</p></div>;
                  }
                  return null;
                }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[8px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Focus</span>
              <span className="text-xl md:text-3xl font-black text-slate-800 tracking-tighter">{Math.floor(totalMinutes/60)}h {totalMinutes%60}m</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// --- 2. テンプレート管理ビュー ---
function TodoTemplateView({ userId }: { userId: string }) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");

  const fetchTemplates = async () => {
    const { data } = await supabase.from("task_templates").select("*").eq("user_id", userId);
    setTemplates(data || []);
  };

  useEffect(() => { fetchTemplates(); }, [userId]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-10">
      <Card className="bg-white border-dashed border-2 md:border-4 rounded-3xl md:rounded-[3rem] border-slate-100 shadow-sm overflow-hidden">
        <CardHeader className="pb-0 pt-6 md:pt-8 text-center"><CardTitle className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center justify-center"><Bookmark className="w-4 h-4 mr-2" /> New Routine</CardTitle></CardHeader>
        <CardContent className="p-5 md:p-10 space-y-4 md:space-y-6">
          <Input id="routine-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Routine name..." className="h-12 md:h-16 rounded-2xl text-base md:text-xl border-none bg-slate-50 px-4 md:px-8 font-bold" aria-label="ルーチン名" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="routine-start" className="text-[8px] font-black text-slate-400 mb-1 block uppercase font-bold">Start</label>
                <Input id="routine-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} className="h-12 md:h-16 rounded-2xl border-none bg-slate-50 font-black text-indigo-600 text-center" aria-label="ルーチン開始" />
              </div>
              <div>
                <label htmlFor="routine-end" className="text-[8px] font-black text-slate-400 mb-1 block uppercase font-bold">End</label>
                <Input id="routine-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="h-12 md:h-16 rounded-2xl border-none bg-slate-50 font-black text-indigo-600 text-center" aria-label="ルーチン終了" />
              </div>
            </div>
            <Button onClick={async () => { if (!title) return; await supabase.from("task_templates").insert([{ title, scheduled_start: start, scheduled_end: end, user_id: userId }]); setTitle(""); fetchTemplates(); }} className="h-12 md:h-16 sm:mt-5 bg-indigo-600 text-white font-black rounded-xl md:rounded-3xl uppercase text-xs shadow-xl shadow-indigo-100">Save</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map(tmpl => (
          <div key={tmpl.id} className="flex flex-col p-4 md:p-6 bg-white border-none rounded-3xl shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <p className="font-black text-base md:text-xl text-slate-700">{tmpl.title}</p>
              <Button variant="ghost" size="icon" className="text-slate-100 hover:text-red-500" onClick={async () => { await supabase.from("task_templates").delete().eq("id", tmpl.id); fetchTemplates(); }} aria-label="削除"><Trash2 className="w-4 h-4" /></Button>
            </div>
            <div className="flex items-center gap-2 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100/50 w-full justify-center">
              <input type="time" value={tmpl.scheduled_start.slice(0, 5)} onChange={async (e) => { await supabase.from("task_templates").update({ scheduled_start: e.target.value }).eq("id", tmpl.id); fetchTemplates(); }} className="bg-transparent text-xs font-black text-indigo-600 w-16 text-center focus:outline-none" aria-label="開始編集" />
              <span className="text-indigo-200 font-black text-xs">TO</span>
              <input type="time" value={tmpl.scheduled_end.slice(0, 5)} onChange={async (e) => { await supabase.from("task_templates").update({ scheduled_end: e.target.value }).eq("id", tmpl.id); fetchTemplates(); }} className="bg-transparent text-xs font-black text-indigo-600 w-16 text-center focus:outline-none" aria-label="終了編集" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 3. 1ヶ月カレンダービュー ---
function TodoMonthView({ userId, viewDate, setViewDate, setTab }: { userId: string, viewDate: Date, setViewDate: any, setTab: any }) {
  const [monthlyTasks, setMonthlyTasks] = useState<any[]>([]);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [taskBreakdown, setTaskBreakdown] = useState<any[]>([]);
  
  const monthStart = startOfMonth(viewDate); const monthEnd = endOfMonth(viewDate);
  const calendarDays = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) });

  useEffect(() => {
    const fetchData = async () => {
      const { data: monthTasks } = await supabase.from("tasks").select("*").eq("user_id", userId).gte("created_at", startOfWeek(monthStart).toISOString()).lte("created_at", endOfWeek(monthEnd).toISOString());
      setMonthlyTasks(monthTasks || []);

      const sixMonthsAgo = dateSubMonths(new Date(), 5); sixMonthsAgo.setDate(1);
      const { data: historyTasks } = await supabase.from("tasks").select("*").eq("user_id", userId).eq("is_completed", true).gte("created_at", sixMonthsAgo.toISOString());
      
      const hData = [];
      for(let i=0; i<6; i++) {
        const target = dateSubMonths(new Date(), 5-i);
        const label = format(target, "MMM", { locale: ja });
        const mTasks = (historyTasks || []).filter(t => isSameDay(startOfMonth(new Date(t.created_at)), startOfMonth(target)));
        const total = mTasks.reduce((acc, t) => {
          const [sh, sm] = t.scheduled_start.split(":").map(Number);
          const [eh, em] = t.scheduled_end.split(":").map(Number);
          return acc + ((eh * 60 + em) - (sh * 60 + sm));
        }, 0) / 60;
        hData.push({ month: label, hours: Math.round(total * 10) / 10 });
      }
      setHistoryData(hData);

      const currentMonthCompleted = (monthTasks || []).filter(t => t.is_completed && isSameDay(startOfMonth(new Date(t.created_at)), monthStart));
      const breakdownMap = new Map();
      currentMonthCompleted.forEach(t => {
        const [sh, sm] = t.scheduled_start.split(":").map(Number);
        const [eh, em] = t.scheduled_end.split(":").map(Number);
        breakdownMap.set(t.title, (breakdownMap.get(t.title) || 0) + ((eh * 60 + em) - (sh * 60 + sm)));
      });
      setTaskBreakdown(Array.from(breakdownMap.entries()).map(([name, mins]) => ({ name, hours: Math.round((mins / 60) * 10) / 10 })).sort((a, b) => b.hours - a.hours));
    };
    fetchData();
  }, [userId, viewDate, monthStart]);

  const getDayData = (day: Date) => {
    const dayTasks = monthlyTasks.filter(t => isSameDay(new Date(t.created_at), day));
    const done = dayTasks.filter(t => t.is_completed).length;
    return { tasks: dayTasks, rate: dayTasks.length > 0 ? done / dayTasks.length : 0, count: dayTasks.length };
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Card className="bg-white shadow-2xl shadow-slate-200/50 border-none rounded-3xl md:rounded-[2.5rem] overflow-hidden">
        <CardHeader className="p-4 md:p-6 border-b flex flex-row items-center justify-between bg-slate-50/30">
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="outline" className="rounded-xl h-8 w-8 md:h-10 md:w-10 p-0 shadow-sm" onClick={() => setViewDate(subMonths(viewDate, 1))} aria-label="前の月"><ChevronLeft className="w-4 h-4" /></Button>
            <CardTitle className="text-sm md:text-xl font-black text-slate-800 tracking-tighter">{format(viewDate, "yyyy年 M月", { locale: ja })}</CardTitle>
            <Button variant="outline" className="rounded-xl h-8 w-8 md:h-10 md:w-10 p-0 shadow-sm" onClick={() => setViewDate(addMonths(viewDate, 1))} aria-label="次の月"><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </CardHeader>
        <div className="grid grid-cols-7 border-b bg-slate-50/20">
          {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => (
            <div key={i} className="py-2 text-center text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-[minmax(60px,auto)] md:auto-rows-[minmax(120px,auto)]">
          {calendarDays.map((day, i) => {
            const { tasks, rate, count } = getDayData(day);
            const isCurrent = day >= monthStart && day <= monthEnd;
            let cellBg = isCurrent ? "bg-white" : "bg-slate-50/30 text-slate-200";
            if (isCurrent && count > 0) {
              if (rate >= 0.8) cellBg = "bg-indigo-600 text-white";
              else if (rate >= 0.4) cellBg = "bg-indigo-100 text-indigo-900";
              else cellBg = "bg-white text-slate-400";
            }
            return (
              <div key={i} onClick={() => { setViewDate(day); setTab("day"); }} className={`p-1 md:p-2 border-r border-b border-slate-100 relative cursor-pointer group transition-all ${cellBg}`} aria-label={`${format(day, "d")}日`}>
                <span className="text-[9px] md:text-[11px] font-black">{format(day, "d")}</span>
                <div className="mt-1 space-y-0.5 hidden md:block">
                  {tasks.slice(0, 2).map((t, idx) => (
                    <div key={idx} className={`text-[8px] px-1 py-0.5 rounded-sm truncate font-bold bg-white/20`}>{t.title}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-none rounded-3xl p-6 shadow-xl shadow-slate-200/50">
          <CardHeader className="p-0 mb-4"><CardTitle className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center italic"><BarChart3 className="w-4 h-4 mr-2 text-indigo-500" /> History (h)</CardTitle></CardHeader>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historyData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#CBD5E1', fontSize: 9, fontWeight: 'bold'}} />
                <Bar dataKey="hours" fill="#4F46E5" radius={[4, 4, 4, 4]} barSize={15} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="bg-white border-none rounded-3xl p-6 shadow-xl shadow-slate-200/50">
          <CardHeader className="p-0 mb-4"><CardTitle className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center italic"><PieIcon className="w-4 h-4 mr-2 text-indigo-500" /> Breakdown (h)</CardTitle></CardHeader>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {taskBreakdown.length > 0 ? (
                <BarChart data={taskBreakdown} layout="vertical" margin={{ top: 0, right: 20, left: 30, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={60} tick={{fill: '#475569', fontSize: 8, fontWeight: 'black'}} />
                  <Bar dataKey="hours" fill="#4F46E5" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-300 font-bold uppercase text-[10px] tracking-[0.2em] italic">No Data</div>
              )}
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}