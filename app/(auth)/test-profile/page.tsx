"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "staff" | "line_manager" | "general_manager" | "admin";
  department_id: string | null;
  line_manager_id: string | null;
  general_manager_id: string | null;
  backup_approver_id: string | null;
};

export default function TestProfilePage() {
  const [status, setStatus] = useState("Loading...");
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function run() {
      setStatus("Checking session...");

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        setStatus("Session error: " + sessionError.message);
        return;
      }

      const user = sessionData.session?.user;
      if (!user) {
        setStatus("Not signed in");
        return;
      }

      setStatus("Fetching profile...");

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id,email,full_name,role,department_id,line_manager_id,general_manager_id,backup_approver_id"
        )
        .eq("id", user.id)
        .single();

      if (error) {
        setStatus("Profile error: " + error.message);
        return;
      }

      setProfile(data as Profile);
      setStatus("Loaded ✅");
    }

    run();
  }, []);

  return (
    <div style={{ padding: 20, maxWidth: 700 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
        Test Profile
      </h1>

      <p style={{ marginBottom: 12 }}>
        <b>Status:</b> {status}
      </p>

      {profile ? (
        <pre
          style={{
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 8,
            background: "#fafafa",
            overflowX: "auto",
          }}
        >
          {JSON.stringify(profile, null, 2)}
        </pre>
      ) : (
        <p>No profile loaded yet.</p>
      )}
    </div>
  );
}
