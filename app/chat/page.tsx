/* eslint-disable react-hooks/set-state-in-effect, react-hooks/static-components */
"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
};

type ChatMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function initialsFor(text: string) {
  return (
    text
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function displayNameFor(profile: Profile) {
  return profile.full_name?.trim() || profile.email || "Inventory User";
}

function roleLabel(role: string | null | undefined) {
  if (role === "admin") return "Admin";
  if (role === "staff") return "Staff";
  return "User";
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function Avatar({ profile, size = "md" }: { profile: Profile; size?: "sm" | "md" | "lg" }) {
  const label = displayNameFor(profile);
  const sizeClass = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-9 w-9" : "h-10 w-10";

  if (profile.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={`${label} profile picture`}
        className={`${sizeClass} shrink-0 rounded-2xl border border-slate-200 object-cover dark:border-zinc-700`}
      />
    );
  }

  return (
    <div className={`${sizeClass} flex shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white dark:bg-zinc-800`}>
      {initialsFor(label)}
    </div>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedUserId) ?? null,
    [profiles, selectedUserId],
  );

  const unreadByUser = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const message of messages) {
      if (message.receiver_id === currentUserId && !message.is_read) {
        counts[message.sender_id] = (counts[message.sender_id] ?? 0) + 1;
      }
    }

    return counts;
  }, [currentUserId, messages]);

  const lastMessageByUser = useMemo(() => {
    const latest: Record<string, ChatMessage> = {};

    for (const message of messages) {
      const otherUserId = message.sender_id === currentUserId ? message.receiver_id : message.sender_id;
      const previous = latest[otherUserId];
      if (!previous || new Date(message.created_at).getTime() > new Date(previous.created_at).getTime()) {
        latest[otherUserId] = message;
      }
    }

    return latest;
  }, [currentUserId, messages]);

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sorted = [...profiles].sort((a, b) => {
      const lastA = lastMessageByUser[a.id]?.created_at ?? "";
      const lastB = lastMessageByUser[b.id]?.created_at ?? "";
      return new Date(lastB).getTime() - new Date(lastA).getTime();
    });

    if (!query) return sorted;

    return sorted.filter((profile) => {
      const text = `${profile.full_name ?? ""} ${profile.email ?? ""} ${profile.role ?? ""}`.toLowerCase();
      return text.includes(query);
    });
  }, [lastMessageByUser, profiles, search]);

  const visibleMessages = useMemo(() => {
    if (!selectedUserId) return [];

    return messages.filter(
      (message) =>
        (message.sender_id === currentUserId && message.receiver_id === selectedUserId) ||
        (message.sender_id === selectedUserId && message.receiver_id === currentUserId),
    );
  }, [currentUserId, messages, selectedUserId]);

  const loadMessages = useCallback(
    async (userId: string) => {
      if (!userId) return;

      const { data, error: messagesError } = await supabase
        .from("chat_messages")
        .select("id, sender_id, receiver_id, body, is_read, created_at")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order("created_at", { ascending: true });

      if (messagesError) {
        setError(messagesError.message);
        return;
      }

      setMessages((data ?? []) as ChatMessage[]);
    },
    [],
  );

  const markConversationRead = useCallback(
    async (otherUserId: string) => {
      if (!currentUserId || !otherUserId) return;

      const { error: updateError } = await supabase
        .from("chat_messages")
        .update({ is_read: true })
        .eq("receiver_id", currentUserId)
        .eq("sender_id", otherUserId)
        .eq("is_read", false);

      if (!updateError) {
        setMessages((current) =>
          current.map((message) =>
            message.receiver_id === currentUserId && message.sender_id === otherUserId
              ? { ...message, is_read: true }
              : message,
          ),
        );
      }
    },
    [currentUserId],
  );

  const loadInitialData = useCallback(async () => {
    setError("");
    setSuccess("");
    setLoadingUsers(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    setCurrentUserId(user.id);

    const { data: profileData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, avatar_url")
      .neq("id", user.id)
      .order("full_name", { ascending: true });

    if (profilesError) {
      setError(profilesError.message);
      setLoadingUsers(false);
      return;
    }

    const nextProfiles = (profileData ?? []) as Profile[];
    setProfiles(nextProfiles);

    if (!selectedUserId && nextProfiles.length > 0) {
      setSelectedUserId(nextProfiles[0].id);
    }

    setLoadingUsers(false);
    setLoadingMessages(true);
    await loadMessages(user.id);
    setLoadingMessages(false);
  }, [loadMessages, router, selectedUserId]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!selectedUserId) return;
    void markConversationRead(selectedUserId);
  }, [markConversationRead, selectedUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages.length, selectedUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel("chat-messages-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        () => {
          void loadMessages(currentUserId);
          if (selectedUserId) {
            void markConversationRead(selectedUserId);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, loadMessages, markConversationRead, selectedUserId]);

  const handleSelectUser = (profileId: string) => {
    setSelectedUserId(profileId);
    setError("");
    setSuccess("");
  };

  const handleSend = async (event?: FormEvent) => {
    event?.preventDefault();

    const body = draft.trim();
    if (!body || !currentUserId || !selectedUserId || sending) return;

    setSending(true);
    setError("");
    setSuccess("");

    const { data, error: insertError } = await supabase
      .from("chat_messages")
      .insert({
        sender_id: currentUserId,
        receiver_id: selectedUserId,
        body,
      })
      .select("id, sender_id, receiver_id, body, is_read, created_at")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSending(false);
      return;
    }

    setMessages((current) => [...current, data as ChatMessage]);
    setDraft("");
    setSuccess("Message sent.");
    setSending(false);
  };

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 dark:bg-black dark:text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-500">Team chat</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Messages</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                Chat with any signed-up user in the inventory app.
              </p>
            </div>
            <button
              onClick={() => void loadInitialData()}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Refresh
            </button>
          </div>

          {(error || success) && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                error
                  ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
              }`}
            >
              {error || success}
            </div>
          )}
        </div>

        <div className="grid min-h-[680px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:grid-cols-[340px_1fr]">
          <aside className="border-b border-slate-200 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-950 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-200 p-4 dark:border-zinc-800">
              <label htmlFor="chat-search" className="sr-only">
                Search users
              </label>
              <input
                id="chat-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search users..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-900"
              />
            </div>

            <div className="max-h-[560px] overflow-y-auto p-3">
              {loadingUsers ? (
                <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
                  Loading users...
                </p>
              ) : filteredProfiles.length === 0 ? (
                <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
                  No users found. Make sure users have signed up and have rows in the profiles table.
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredProfiles.map((profile) => {
                    const active = profile.id === selectedUserId;
                    const lastMessage = lastMessageByUser[profile.id];
                    const unreadCount = unreadByUser[profile.id] ?? 0;
                    const lastMessagePrefix = lastMessage?.sender_id === currentUserId ? "You: " : "";

                    return (
                      <button
                        key={profile.id}
                        onClick={() => handleSelectUser(profile.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                          active
                            ? "border-slate-900 bg-slate-900 text-white dark:border-zinc-700 dark:bg-zinc-800"
                            : "border-slate-200 bg-white text-slate-950 hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                        }`}
                      >
                        <Avatar profile={profile} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-bold">{displayNameFor(profile)}</span>
                            {unreadCount > 0 && (
                              <span className="ml-auto inline-flex min-w-[22px] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                                {unreadCount > 99 ? "99+" : unreadCount}
                              </span>
                            )}
                          </span>
                          <span className={`mt-0.5 block truncate text-xs ${active ? "text-slate-300" : "text-slate-500 dark:text-zinc-400"}`}>
                            {lastMessage ? `${lastMessagePrefix}${lastMessage.body}` : `${roleLabel(profile.role)} · Start a chat`}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <section className="flex min-h-[680px] flex-col bg-white dark:bg-black">
            {selectedProfile ? (
              <>
                <div className="flex items-center gap-3 border-b border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <Avatar profile={selectedProfile} size="lg" />
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-slate-950 dark:text-white">{displayNameFor(selectedProfile)}</h2>
                    <p className="truncate text-sm text-slate-500 dark:text-zinc-400">
                      {selectedProfile.email || "No email listed"} · {roleLabel(selectedProfile.role)}
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-black">
                  {loadingMessages ? (
                    <p className="text-sm text-slate-500 dark:text-zinc-400">Loading messages...</p>
                  ) : visibleMessages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center">
                      <div className="max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                        <p className="text-lg font-bold text-slate-950 dark:text-white">No messages yet</p>
                        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
                          Send the first message to start this conversation.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visibleMessages.map((message) => {
                        const mine = message.sender_id === currentUserId;

                        return (
                          <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[78%] rounded-3xl px-4 py-3 shadow-sm ${
                                mine
                                  ? "bg-slate-900 text-white dark:bg-zinc-800"
                                  : "border border-slate-200 bg-white text-slate-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                              <div className={`mt-1 flex items-center gap-2 text-[11px] ${mine ? "text-slate-300" : "text-slate-500 dark:text-zinc-500"}`}>
                                <span>{formatMessageTime(message.created_at)}</span>
                                {mine && <span>{message.is_read ? "Read" : "Sent"}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                <form onSubmit={handleSend} className="border-t border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label htmlFor="message" className="sr-only">
                      Message
                    </label>
                    <textarea
                      id="message"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={handleDraftKeyDown}
                      rows={2}
                      maxLength={2000}
                      placeholder="Type a message..."
                      className="min-h-[52px] flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-900"
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim() || sending}
                      className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-black dark:hover:bg-white"
                    >
                      {sending ? "Sending..." : "Send"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">Press Enter to send. Press Shift + Enter for a new line.</p>
                </form>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-center">
                <div className="max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-lg font-bold text-slate-950 dark:text-white">Select a user</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
                    Choose a signed-up user from the left side to start chatting.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
