import { supabase } from "@/lib/supabase";

type NotifyArgs = {
  title: string;
  message: string;
  currentUserId: string;
};

export async function createNotificationsForUserAndAdmins({
  title,
  message,
  currentUserId,
}: NotifyArgs) {
  const { data: adminProfiles, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  if (error) {
    console.error("Failed to load admin profiles:", error.message);
    return;
  }

  const adminIds = (adminProfiles ?? [])
    .map((profile) => profile.id)
    .filter(Boolean) as string[];

  const recipientIds = Array.from(new Set([currentUserId, ...adminIds]));

  if (recipientIds.length === 0) return;

  const rows = recipientIds.map((userId) => ({
    user_id: userId,
    title,
    message,
    is_read: false,
  }));

  const { error: insertError } = await supabase
    .from("notifications")
    .insert(rows);

  if (insertError) {
    console.error("Failed to create notifications:", insertError.message);
  }
}