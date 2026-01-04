import { supabase } from "@/lib/supabase/client";

export type CalendarLeaveEvent = {
  id: string;
  requester_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  status: string;
  leave_type: string;
  days: number;
  department_id: string | null;
  // optional display fields if you add joins later
  full_name?: string | null;
};

/**
 * Fetch leave requests that overlap a date range.
 * RLS will automatically filter rows by user role (staff/LM/GM).
 */
export async function getCalendarLeaves(params: { from: string; to: string }) {
  const { from, to } = params;

  // Overlap condition:
  // start_date <= to AND end_date >= from
  const { data, error } = await supabase
    .from("leave_requests")
    .select("id,requester_id,start_date,end_date,status,leave_type,days,department_id")
    .lte("start_date", to)
    .gte("end_date", from)
    .neq("status", "cancelled")
    .order("start_date", { ascending: true });

  if (error) throw error;

  return (data ?? []) as CalendarLeaveEvent[];
}
