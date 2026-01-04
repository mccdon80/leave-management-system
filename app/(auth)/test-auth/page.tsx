"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function TestAuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [status, setStatus] = useState("Checking session...");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  async function refreshSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setStatus("Error: " + error.message);
      setUserEmail(null);
      return;
    }
    const session = data.session;
    if (!session) {
      setStatus("Not signed in");
      setUserEmail(null);
    } else {
      setStatus("Signed in ✅");
      setUserEmail(session.user.email ?? null);
    }
  }

  useEffect(() => {
    refreshSession();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refreshSession();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signUp() {
    setStatus("Signing up...");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setStatus("Signup error: " + error.message);
    else setStatus("Signup success ✅ (check email if confirmation is enabled)");
  }

  async function signIn() {
    setStatus("Signing in...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setStatus("Signin error: " + error.message);
    else setStatus("Signin success ✅");
  }

  async function signOut() {
    setStatus("Signing out...");
    const { error } = await supabase.auth.signOut();
    if (error) setStatus("Signout error: " + error.message);
    else setStatus("Signed out ✅");
  }

  return (
    <div style={{ padding: 20, maxWidth: 420 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Test Auth</h1>

      <p style={{ marginBottom: 12 }}>
        <b>Status:</b> {status}
        <br />
        <b>User:</b> {userEmail ?? "-"}
      </p>

      <div style={{ display: "grid", gap: 8 }}>
        <input
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
        />
        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
        />

        <button onClick={signUp} style={{ padding: 10 }}>
          Sign Up
        </button>
        <button onClick={signIn} style={{ padding: 10 }}>
          Sign In
        </button>
        <button onClick={signOut} style={{ padding: 10 }}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
