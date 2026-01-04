"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function TestSupabasePage() {
  const [status, setStatus] = useState("Testing...");

  useEffect(() => {
    async function run() {
      const { data, error } = await supabase.from("departments").select("*").limit(1);
      if (error) setStatus("Error: " + error.message);
      else setStatus("Connected ✅ Departments rows fetched: " + data.length);
    }
    run();
  }, []);

  return <div style={{ padding: 20 }}>{status}</div>;
}
