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
import { ChevronLeft, ChevronRight, Trash2, Bookmark, Plus, Sparkles, Clock, Zap, Timer, AlertCircle, BarChart3, PieChart as PieIcon, LayoutDashboard } from "lucide-react";

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState("day");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="flex justify-center items-center min-h-screen bg-slate-50 font-black text-slate-400 tracking-[0.5em] animate-pulse">BOOTING SYSTEM...</div>;
  if (!user) return <AuthForm />;

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-20 font-sans text-slate-900 selection:bg-indigo-100">
      {/* Navigation: Glassmorphism */}
      <nav className="flex justify-between items-center px-8 h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-1.5 rounded-lg shadow-lg shadow-indigo-200">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-slate-800 tracking-tighter text-2xl uppercase">Arata<span className="text-indigo-600">Log</span></span>
        </div>
        <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()} className="rounded-full border-slate-200 text-slate-500 font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all">SIGN OUT</Button>
      </nav>

      <main className="p-6 max-w-6xl mx-auto space-y-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-10 bg-slate-200/50 border-none h-16 p-1.5 rounded-[2rem]">
            <TabsTrigger value="day" className="font-black text-xs uppercase data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-lg rounded-[1.5rem] transition-all duration-300">Daily Focus</TabsTrigger>
            <TabsTrigger value="month" className="font-black text-xs uppercase data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-lg rounded-[1.5rem] transition-all duration-300">Insights</TabsTrigger>
            <TabsTrigger value="template" className="font-black text-xs uppercase data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-lg rounded-[1.5rem] transition-all duration-300">Routines</TabsTrigger>
          </TabsList>

          <TabsContent value="day" className="space-y-8 outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
            <TodoDayView userId={user.id} date={currentDate} setDate={setCurrentDate} />
          </TabsContent>

          <TabsContent value="month" className="space-y-8 outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
            <TodoMonthView userId={user.id} viewDate={currentDate} setViewDate={setCurrentDate} setTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="template" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
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
  const [templates, setTemplates] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  const fetchData = async () => {
    const start = startOfDay(date); const end = endOfDay(date);
    const { data: tasksData } = await supabase.from("tasks").select("*").eq("user_id", userId)
      .gte("created_at", start.toISOString()).lte("created_at", end.toISOString()).order("scheduled_start", { ascending: true });
    setTasks(tasksData || []);
    const { data: tmplData } = await supabase.from("task_templates").select("*").eq("user_id", userId);
    setTemplates(tmplData || []);
  };

  useEffect(() => { fetchData(); }, [userId, date]);

  const timeBoxingData = useMemo(() => {
    if (tasks.length === 0) return [{ value: 1440, color: "#E2E8F0", isTask: false }];
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

  const addAllTemplates = async () => {
    if (templates.length === 0) return;
    await supabase.from("tasks").insert(templates.map(tmp => ({ title: tmp.title, scheduled_start: tmp.scheduled_start, scheduled_end: tmp.scheduled_end, user_id: userId, created_at: date.toISOString() })));
    fetchData();
  };

  const totalMinutes = tasks.filter(t => t.is_completed).reduce((acc, t) => {
    const [sh, sm] = t.scheduled_start.split(":").map(Number);
    const [eh, em] = t.scheduled_end.split(":").map(Number);
    return acc + ((eh * 60 + em) - (sh * 60 + sm));
  }, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
      <div className="lg:col-span-7 space-y-8">
        {/* Date Nav */}
        <div className="flex items-center justify-between bg-white p-2.5 rounded-[2rem] border-none shadow-xl shadow-slate-200/50 h-20 px-6">
          <Button variant="ghost" className="h-14 w-14 rounded-full hover:bg-slate-100 transition-all" onClick={() => setDate(subDays(date, 1))} aria-label="前の日"><ChevronLeft className="w-6 h-6" /></Button>
          <div className="text-center">
            <span className="font-black text-2xl text-slate-800 tracking-tighter">{format(date, "M月d日", { locale: ja })}</span>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{format(date, "eeee", { locale: ja })}</span>
          </div>
          <Button variant="ghost" className="h-14 w-14 rounded-full hover:bg-slate-100 transition-all" onClick={() => setDate(addDays(date, 1))} aria-label="次の日"><ChevronRight className="w-6 h-6" /></Button>
        </div>

        {/* Routine Deck: Styled as Indigo Panel */}
        <div className="p-8 bg-indigo-600 rounded-[3rem] shadow-2xl shadow-indigo-200 space-y-6 relative overflow-hidden group">
          <div className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-all duration-700" />
          <div className="flex justify-between items-center relative z-10">
            <p className="text-[10px] font-black text-indigo-100 uppercase tracking-[0.3em] flex items-center"><Zap className="w-4 h-4 mr-2" /> Routine Deck</p>
            {templates.length > 0 && <Button onClick={addAllTemplates} size="sm" className="bg-white text-indigo-600 hover:bg-indigo-50 font-black text-[10px] h-9 rounded-full border-none px-6 shadow-lg shadow-indigo-900/20 uppercase">Apply All</Button>}
          </div>
          <div className="flex flex-wrap gap-3 relative z-10">
            {templates.map(tmpl => <button key={tmpl.id} onClick={() => addTask(tmpl.title, tmpl.scheduled_start, tmpl.scheduled_end)} className="bg-indigo-500/50 backdrop-blur-sm border border-indigo-400/30 text-white px-5 py-3 rounded-2xl font-black text-xs hover:bg-white hover:text-indigo-600 active:scale-95 transition-all flex items-center shadow-sm"><Plus className="w-3.5 h-3.5 mr-2" /> {tmpl.title}</button>)}
          </div>
        </div>

        {/* Input Form: Minimalist Card */}
        <Card className="rounded-[2.5rem] border-none shadow-xl shadow-slate-200/60 overflow-hidden bg-white/70 backdrop-blur-sm">
          <CardContent className="p-6 space-y-4">
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Type mission name..." aria-label="タスク名" className="h-14 text-lg rounded-2xl border-none bg-slate-100/50 focus:bg-white transition-all px-6 font-medium" />
            <div className="flex gap-3">
              <Input type="time" aria-label="開始時間" className="h-14 flex-1 rounded-2xl border-none bg-slate-100/50 focus:bg-white px-6 font-bold" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              <Input type="time" aria-label="終了時間" className="h-14 flex-1 rounded-2xl border-none bg-slate-100/50 focus:bg-white px-6 font-bold" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              <Button onClick={() => addTask()} className="h-14 px-10 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 uppercase text-xs tracking-widest">Add</Button>
            </div>
          </CardContent>
        </Card>

        {/* Task List: Soft Cards */}
        <div className="space-y-4">
          {tasks.map(t => (
            <div key={t.id} className="group flex flex-col sm:flex-row sm:items-center p-6 bg-white border-none rounded-[2rem] shadow-sm hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300">
              <div className="flex items-center flex-1">
                <Checkbox checked={t.is_completed} aria-label="完了" className="w-7 h-7 rounded-xl border-slate-200 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600" onCheckedChange={async () => { await supabase.from("tasks").update({ is_completed: !t.is_completed }).eq("id", t.id); fetchData(); }} />
                <div className="ml-5 flex-1"><p className={`font-black text-lg tracking-tight ${t.is_completed ? "line-through text-slate-300" : "text-slate-700"}`}>{t.title}</p></div>
              </div>
              <div className="flex items-center justify-between mt-4 sm:mt-0 sm:ml-6 gap-4">
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                  <input type="time" aria-label="開始" value={t.scheduled_start.slice(0, 5)} onChange={async (e) => { await supabase.from("tasks").update({ scheduled_start: e.target.value }).eq("id", t.id); fetchData(); }} className="bg-transparent text-[11px] font-black text-indigo-500 w-16 focus:outline-none" />
                  <span className="text-slate-300 text-[10px]">—</span>
                  <input type="time" aria-label="終了" value={t.scheduled_end.slice(0, 5)} onChange={async (e) => { await supabase.from("tasks").update({ scheduled_end: e.target.value }).eq("id", t.id); fetchData(); }} className="bg-transparent text-[11px] font-black text-indigo-500 w-16 focus:outline-none" />
                </div>
                <Button variant="ghost" size="icon" aria-label="削除" className="text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl" onClick={async () => { await supabase.from("tasks").delete().eq("id", t.id); fetchData(); }}><Trash2 className="w-5 h-5" /></Button>
              </div>
            </div>
          ))}
          {tasks.length === 0 && <p className="text-center py-24 text-slate-300 font-black italic uppercase tracking-[0.4em] text-[10px]">No active missions.</p>}
        </div>
      </div>

      {/* Right Sidebar: Charts */}
      <div className="lg:col-span-5 space-y-8">
        <Card className="rounded-[3.5rem] bg-white border-none shadow-2xl shadow-slate-200/80 p-8 sticky top-28 overflow-hidden group">
          <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="p-0 mb-8 text-center">
            <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] flex items-center justify-center italic"><Timer className="w-4 h-4 mr-2 text-indigo-500" /> Time Box Chart</CardTitle>
          </CardHeader>
          <div className="h-80 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={timeBoxingData} 
                  innerRadius={75} outerRadius={115} 
                  dataKey="value" stroke="none" 
                  startAngle={90} endAngle={-270}
                  label={(props: any) => {
                    const { cx, cy, midAngle, innerRadius, outerRadius, value, payload } = props;
                    if (!payload.isTask || value < 45 || midAngle === undefined) return null;
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-[9px] font-black pointer-events-none">{payload.time.split('-')[0]}</text>;
                  }}
                  labelLine={false}
                >
                  {timeBoxingData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} className="outline-none transition-all duration-500" />)}
                </Pie>
                <RechartsTooltip content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload; if (!d.isTask) return null;
                    return (
                      <div className="bg-slate-900/90 backdrop-blur-md p-4 border-none rounded-[1.5rem] shadow-2xl text-white">
                        {d.isOverlap && <p className="text-[9px] font-black text-red-400 flex items-center mb-1 uppercase tracking-tighter"><AlertCircle className="w-3 h-3 mr-1" /> Overlap Detected</p>}
                        <p className="font-black text-sm leading-tight">{d.isOverlap ? d.taskNames : d.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1.5">{d.time}</p>
                      </div>
                    );
                  }
                  return null;
                }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic mb-2">Total Effor</span>
              <span className="text-4xl font-black text-slate-800 tracking-tighter">{Math.floor(totalMinutes/60)}<span className="text-indigo-600">h</span> {totalMinutes%60}<span className="text-indigo-600">m</span></span>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-5">
             {[{c:"bg-indigo-600", t:"Done"}, {c:"bg-indigo-300", t:"Plan"}, {c:"bg-red-500", t:"Conflict"}, {c:"bg-slate-50", t:"Free"}].map(l => <div key={l.t} className="flex items-center gap-2"><div className={`w-2.5 h-2.5 rounded-full ${l.c}`} /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{l.t}</span></div>)}
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

  const addTemplate = async () => {
    if (!title) return;
    await supabase.from("task_templates").insert([{ title, scheduled_start: start, scheduled_end: end, user_id: userId }]);
    setTitle(""); fetchTemplates();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-700">
      <Card className="bg-white border-dashed border-4 rounded-[3rem] border-slate-100 shadow-sm">
        <CardHeader className="pb-0 pt-8 text-center"><CardTitle className="text-[11px] font-black text-slate-300 uppercase tracking-[0.6em] flex items-center justify-center"><Bookmark className="w-5 h-5 mr-3 text-indigo-400" /> Register Routine</CardTitle></CardHeader>
        <CardContent className="p-10 space-y-6">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Routine name..." aria-label="テンプレート名" className="h-16 rounded-2xl text-xl border-none bg-slate-50 px-8 font-bold" />
          <div className="flex gap-4">
            <div className="flex-1"><label className="text-[10px] font-black text-slate-400 ml-2 mb-2 block uppercase">Start</label><Input type="time" aria-label="テンプレート開始" value={start} onChange={(e) => setStart(e.target.value)} className="h-16 rounded-2xl border-none bg-slate-50 font-black text-indigo-600 px-8" /></div>
            <div className="flex-1"><label className="text-[10px] font-black text-slate-400 ml-2 mb-2 block uppercase">End</label><Input type="time" aria-label="テンプレート終了" value={end} onChange={(e) => setEnd(e.target.value)} className="h-16 rounded-2xl border-none bg-slate-50 font-black text-indigo-600 px-8" /></div>
            <Button onClick={addTemplate} className="h-16 mt-6 px-12 bg-indigo-600 font-black rounded-2xl text-white shadow-xl shadow-indigo-100 active:scale-95 uppercase tracking-widest text-xs">Save Routine</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map(tmpl => (
          <div key={tmpl.id} className="group flex flex-col p-6 bg-white border-none rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-500">
            <div className="flex justify-between items-start mb-4">
              <p className="font-black text-xl text-slate-700 leading-tight">{tmpl.title}</p>
              <Button variant="ghost" size="icon" aria-label="削除" className="text-slate-100 hover:text-red-500 hover:bg-red-50 rounded-full h-10 w-10 transition-colors" onClick={async () => { await supabase.from("task_templates").delete().eq("id", tmpl.id); fetchTemplates(); }}><Trash2 className="w-5 h-5" /></Button>
            </div>
            <div className="flex items-center gap-2 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 w-full justify-center">
              <input type="time" aria-label="テンプレ開始" value={tmpl.scheduled_start.slice(0, 5)} onChange={async (e) => { await supabase.from("task_templates").update({ scheduled_start: e.target.value }).eq("id", tmpl.id); fetchTemplates(); }} className="bg-transparent text-sm font-black text-indigo-600 w-18 text-center focus:outline-none" />
              <span className="text-indigo-200 font-black px-2">TO</span>
              <input type="time" aria-label="テンプレ終了" value={tmpl.scheduled_end.slice(0, 5)} onChange={async (e) => { await supabase.from("task_templates").update({ scheduled_end: e.target.value }).eq("id", tmpl.id); fetchTemplates(); }} className="bg-transparent text-sm font-black text-indigo-600 w-18 text-center focus:outline-none" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 3. 1ヶ月カレンダービュー + 分析グラフ ---
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
        const mins = (eh * 60 + em) - (sh * 60 + sm);
        breakdownMap.set(t.title, (breakdownMap.get(t.title) || 0) + mins);
      });
      const bData = Array.from(breakdownMap.entries())
        .map(([name, mins]) => ({ name, hours: Math.round((mins / 60) * 10) / 10 }))
        .sort((a, b) => b.hours - a.hours);
      setTaskBreakdown(bData);
    };

    fetchData();
  }, [userId, viewDate, monthStart]);

  const getDayData = (day: Date) => {
    const dayTasks = monthlyTasks.filter(t => isSameDay(new Date(t.created_at), day));
    const done = dayTasks.filter(t => t.is_completed).length;
    return { tasks: dayTasks, rate: dayTasks.length > 0 ? done / dayTasks.length : 0, count: dayTasks.length };
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-1000">
      {/* Calendar Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tighter">{format(viewDate, "yyyy")}</h2>
          <p className="text-indigo-600 font-black text-6xl uppercase tracking-tighter leading-none mt-2">{format(viewDate, "MMMM", { locale: ja })}</p>
        </div>
        <div className="flex gap-3 bg-white p-2 rounded-[1.5rem] shadow-xl shadow-slate-200/50 border border-slate-100">
          <Button variant="ghost" className="h-14 w-14 rounded-2xl hover:bg-slate-50 transition-all" onClick={() => setViewDate(subMonths(viewDate, 1))} aria-label="前の月"><ChevronLeft className="w-6 h-6" /></Button>
          <Button variant="ghost" className="h-14 w-14 rounded-2xl hover:bg-slate-50 transition-all" onClick={() => setViewDate(addMonths(viewDate, 1))} aria-label="次の月"><ChevronRight className="w-6 h-6" /></Button>
        </div>
      </div>

      {/* Modern Calendar Grid */}
      <Card className="bg-white/70 backdrop-blur-md shadow-2xl shadow-slate-200/50 border-none rounded-[3.5rem] overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(w => (
            <div key={w} className="py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-[minmax(130px,auto)]">
          {calendarDays.map((day, i) => {
            const { tasks, rate, count } = getDayData(day);
            const isCurrent = day >= monthStart && day <= monthEnd;
            let cellBg = isCurrent ? "bg-white" : "bg-slate-50/30 text-slate-200";
            let indicatorColor = "bg-slate-100";
            if (isCurrent && count > 0) {
              if (rate >= 0.8) { cellBg = "bg-indigo-600 text-white shadow-inner"; indicatorColor = "bg-indigo-400"; }
              else if (rate >= 0.4) { cellBg = "bg-indigo-100 text-indigo-900"; indicatorColor = "bg-indigo-300"; }
              else { cellBg = "bg-white text-slate-400"; indicatorColor = "bg-indigo-100"; }
            }
            return (
              <div key={i} onClick={() => { setViewDate(day); setTab("day"); }} className={`p-3 border-r border-b border-slate-100 relative cursor-pointer group transition-all duration-300 hover:z-10 hover:shadow-2xl hover:scale-[1.05] ${cellBg}`}>
                <span className="text-[11px] font-black">{format(day, "d")}</span>
                <div className="mt-3 space-y-1.5">
                  {tasks.slice(0, 3).map((t, idx) => (
                    <div key={idx} className={`text-[9px] px-2 py-1 rounded-lg truncate leading-tight font-bold border-none shadow-sm ${t.is_completed ? (rate >= 0.8 ? "bg-indigo-500/50 text-white/50 line-through" : "bg-slate-100 text-slate-300 line-through") : (rate >= 0.8 ? "bg-white text-indigo-600" : "bg-indigo-600 text-white")}`}>{t.title}</div>
                  ))}
                  {tasks.length > 3 && <p className="text-[8px] font-black text-center opacity-40">+ {tasks.length - 3} more</p>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Analytics: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <Card className="bg-white border-none rounded-[3.5rem] p-10 shadow-2xl shadow-slate-200/50 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600 opacity-20 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="p-0 mb-8 flex flex-row items-center justify-between">
            <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] flex items-center italic"><BarChart3 className="w-5 h-5 mr-3 text-indigo-500" /> Growth Curve (h)</CardTitle>
          </CardHeader>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historyData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#CBD5E1', fontSize: 10, fontWeight: 'bold'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#CBD5E1', fontSize: 10, fontWeight: 'bold'}} />
                <RechartsTooltip cursor={{fill: '#F1F5F9'}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)'}} />
                <Bar dataKey="hours" fill="#4F46E5" radius={[12, 12, 12, 12]} barSize={24}>
                  {historyData.map((_e, index) => <Cell key={`cell-${index}`} fill={index === 5 ? '#4F46E5' : '#E2E8F0'} className="transition-all duration-700" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="bg-white border-none rounded-[3.5rem] p-10 shadow-2xl shadow-slate-200/50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-indigo-600 opacity-20 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="p-0 mb-8">
            <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] flex items-center italic"><PieIcon className="w-5 h-5 mr-3 text-indigo-500" /> Task Composition (h)</CardTitle>
          </CardHeader>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {taskBreakdown.length > 0 ? (
                <BarChart data={taskBreakdown} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{fill: '#475569', fontSize: 10, fontWeight: 'black'}} />
                  <RechartsTooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)'}} />
                  <Bar dataKey="hours" fill="#4F46E5" radius={[0, 12, 12, 0]} barSize={18} />
                </BarChart>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-300 font-black uppercase tracking-[0.3em] text-[10px] italic">No analytics available</div>
              )}
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}