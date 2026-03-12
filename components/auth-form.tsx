"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // サインアップ処理
  const handleSignUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert("登録完了！ログインしてください。");
    setLoading(false);
  };

  // ログイン処理
  const handleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    setLoading(false);
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">ToDoアプリにログイン</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="email" placeholder="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="password" placeholder="パスワード" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="flex flex-col gap-2">
            <Button onClick={handleLogin} disabled={loading}>ログイン</Button>
            <Button variant="outline" onClick={handleSignUp} disabled={loading}>新規登録</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}