"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { fetchIncomingRequests, acceptFriendRequest, removeFriendship, FriendRequest } from "@/lib/supabase/friends";
import { errorMessage } from "@/lib/errorMessage";

export default function NotificationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<FriendRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/account");
      return;
    }
    fetchIncomingRequests(user.id)
      .then(setRequests)
      .catch((err) => setError(errorMessage(err)));
  }, [user, loading, router]);

  async function handleAccept(req: FriendRequest) {
    setBusyId(req.id);
    const { error } = await acceptFriendRequest(req.id);
    setBusyId(null);
    if (error) {
      setError(error);
      return;
    }
    setRequests((prev) => prev?.filter((r) => r.id !== req.id) ?? null);
  }

  async function handleDecline(req: FriendRequest) {
    setBusyId(req.id);
    const { error } = await removeFriendship(req.id);
    setBusyId(null);
    if (error) {
      setError(error);
      return;
    }
    setRequests((prev) => prev?.filter((r) => r.id !== req.id) ?? null);
  }

  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-md w-full mx-auto">
      <div className="text-center mb-10">
        <div className="text-xs text-white/45 tracking-[0.25em] mb-1">FRIEND REQUESTS</div>
        <h1 className="text-[clamp(2rem,8vw,3rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          NOTIFICATIONS
        </h1>
      </div>

      {error && <p className="text-sm text-red-400 text-center mb-4">{error}</p>}

      {!requests ? (
        <div className="flex justify-center py-10">
          <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-white/50">
          <div className="text-4xl mb-3">🔔</div>
          <p className="text-sm">No pending friend requests.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((req) => {
            const label = req.display_name || req.username;
            return (
              <div key={req.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <Link href={`/leaderboard/${req.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                  {req.avatar_url ? (
                    <img src={req.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="h-9 w-9 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-xs">
                      {label.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="text-sm truncate">{label}</span>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleAccept(req)}
                    disabled={busyId === req.id}
                    className="rounded-full px-3 py-1.5 text-xs disabled:opacity-50 active:scale-95 transition-transform duration-150"
                    style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleDecline(req)}
                    disabled={busyId === req.id}
                    className="text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
