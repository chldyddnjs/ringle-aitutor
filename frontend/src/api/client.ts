/// <reference types="vite/client" />
import type { MembershipPlan, Membership, ChatMessage, AdminUser } from "../types";
export type { MembershipPlan, Membership, ChatMessage, AdminUser };

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export const getUserId   = (): string => localStorage.getItem("userId") ?? "";
export const setUserId   = (id: string) => localStorage.setItem("userId", id);
export const clearUserId = () => localStorage.removeItem("userId");

function authHeaders(extra: Record<string, string> = {}): HeadersInit {
  const id = getUserId();
  return {
    "Content-Type": "application/json",
    ...(id ? { "X-User-Id": id } : {}),
    ...extra,
  };
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw { status: res.status, ...(err as object) };
  }
  return res.json() as Promise<T>;
}

// Plans
export const fetchPlans = () =>
  fetch(`${BASE}/membership_plans`, { headers: authHeaders() })
    .then(r => handle<MembershipPlan[]>(r));

// Memberships
export const fetchActiveMembership = () =>
  fetch(`${BASE}/memberships/active`, { headers: authHeaders() })
    .then(r => handle<{ active: boolean; membership: Membership | null }>(r));

// Payments
export const purchasePlan = (planId: string, paymentMethod = "card") =>
  fetch(`${BASE}/payments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ membership_plan_id: planId, payment_method: paymentMethod }),
  }).then(r => handle<{ message: string; membership: Membership; payment: object }>(r));

// STT
export async function transcribeAudio(blob: Blob): Promise<string> {
  const id   = getUserId();
  const form = new FormData();
  form.append("audio", blob, "recording.webm");
  const res = await fetch(`${BASE}/ai/stt`, {
    method: "POST",
    headers: id ? { "X-User-Id": id } : {},
    body: form,
  });
  const data = await handle<{ text: string }>(res);
  return data.text;
}

// TTS
export async function synthesizeSpeech(text: string): Promise<Blob> {
  const res = await fetch(`${BASE}/ai/tts`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw await res.json().catch(() => ({ error: "TTS failed" }));
  return res.blob();
}

// Chat SSE streaming
export function streamChat(
  messages: Pick<ChatMessage, "role" | "content">[],
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void,
): () => void {
  const ctrl = new AbortController();
  const id   = getUserId();

  fetch(`${BASE}/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(id ? { "X-User-Id": id } : {}) },
    body: JSON.stringify({ messages }),
    signal: ctrl.signal,
  })
    .then(async res => {
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: "Chat error" }));
        onError((e as { error: string }).error ?? "Chat failed");
        return;
      }
      const reader  = res.body?.getReader();
      if (!reader) { onError("No stream"); return; }
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") { onDone(); return; }
          try {
            const parsed = JSON.parse(data);
            if (typeof parsed === "string") onChunk(parsed);
            if (parsed?.error) { onError(parsed.error as string); return; }
          } catch { /* partial */ }
        }
      }
      onDone();
    })
    .catch(e => { if ((e as { name?: string }).name !== "AbortError") onError((e as Error).message ?? "Connection error"); });

  return () => ctrl.abort();
}

// Admin
export const adminFetchUsers = (page = 1) =>
  fetch(`${BASE}/admin/users?page=${page}`, { headers: authHeaders() })
    .then(r => handle<{ users: AdminUser[]; meta: { total: number } }>(r));

export const adminFetchMemberships = (page = 1) =>
  fetch(`${BASE}/admin/memberships?page=${page}`, { headers: authHeaders() })
    .then(r => handle<{ memberships: Membership[]; meta: { total: number } }>(r));

export const adminGrantMembership = (userId: string, planId: string) =>
  fetch(`${BASE}/admin/memberships`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ user_id: userId, membership_plan_id: planId }),
  }).then(r => handle<Membership>(r));

export const adminRevokeMembership = (id: string) =>
  fetch(`${BASE}/admin/memberships/${id}`, { method: "DELETE", headers: authHeaders() })
    .then(r => handle<{ message: string }>(r));

// 데모용: 인증 없이 유저 목록 조회
export interface DemoUser {
  id: string;
  name: string;
  email: string;
  admin: boolean;
  active_membership: {
    plan_name: string;
    features: string[];
    days_remaining: number;
  } | null;
}

export const fetchDemoUsers = () =>
  fetch(`${BASE}/users/demo`)
    .then(r => handle<DemoUser[]>(r));
