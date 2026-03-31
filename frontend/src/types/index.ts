export interface MembershipPlan {
  id: string;
  name: string;
  price_cents: number;
  price_display: string;
  currency: string;
  duration_days: number;
  features: { learning: boolean; conversation: boolean; analysis: boolean };
}

export interface Membership {
  id: string;
  status: "active" | "expired" | "cancelled";
  active: boolean;
  starts_at: string;
  expires_at: string;
  days_remaining: number;
  granted_by: "user" | "admin";
  plan: { id: string; name: string; features: string[]; duration_days: number };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  audioUrl?: string;
  timestamp: Date;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  admin: boolean;
  active_membership: {
    id: string;
    plan_name: string;
    features: string[];
    expires_at: string;
    days_remaining: number;
  } | null;
}
