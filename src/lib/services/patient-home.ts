import type { SupabaseClient } from "@supabase/supabase-js";
import type { PatientHomePayload } from "@/lib/types/engagement";

export async function fetchPatientHomePayload(
  supabase: SupabaseClient,
): Promise<PatientHomePayload> {
  const { data, error } = await supabase.rpc("get_patient_home_payload", {});
  if (error) throw error;
  return data as unknown as PatientHomePayload;
}
