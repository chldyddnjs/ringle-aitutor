import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  adminFetchUsers, adminFetchMemberships, adminGrantMembership,
  adminRevokeMembership, fetchPlans, setUserId,
} from "../api/client";
import type { AdminUser, Membership, MembershipPlan } from "../types";

export function AdminPage() {
  const navigate = useNavigate();
  const [tab,         setTab]         = useState<"users" | "memberships">("users");
  const [users,       setUsers]       = useState<AdminUser[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [plans,       setPlans]       = useState<MembershipPlan[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState<string | null>(null);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantPlanId, setGrantPlanId] = useState("");
  const [granting,    setGranting]    = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true); 
    setError(null);
    try {
      const [u, m, p] = await Promise.all([adminFetchUsers(), adminFetchMemberships(), fetchPlans()]);
      const uniquePlans = p.filter((plan, index, self) =>
        index === self.findIndex((p) => p.name === plan.name)
      );
      setUsers(u.users); 
      setMemberships(m.memberships); 
      setPlans(uniquePlans);
    } catch (e: unknown) {
      setError((e as { error?: string })?.error ?? "데이터 로드 실패. Admin 계정 ID를 확인하세요.");
    } finally { setLoading(false); }
  }

  async function handleGrant() {
    if (!grantUserId || !grantPlanId) return;
    setGranting(true); 
    setError(null);
    try {
      await adminGrantMembership(grantUserId, grantPlanId);
      setSuccess("멤버십이 부여되었습니다."); setGrantUserId(""); setGrantPlanId("");
      await loadAll();
    } catch (e: unknown) {
      setError((e as { error?: string })?.error ?? "부여 실패");
    } finally { setGranting(false); }
  }

  async function handleRevoke(id: string) {
    if (!confirm("멤버십을 취소하시겠습니까?")) return;
    try {
      await adminRevokeMembership(id);
      setSuccess("멤버십이 취소되었습니다."); await loadAll();
    } catch (e: unknown) {
      setError((e as { error?: string })?.error ?? "취소 실패");
    }
  }

  function loginAs(userId: string, name: string) {
    setUserId(userId);
    setSuccess(`"${name}" 계정으로 전환했습니다.`);
    setTimeout(() => navigate("/"), 800);
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 20px", border: "none", background: "none", cursor: "pointer",
    fontWeight: active ? 600 : 400, fontSize: "15px",
    color: active ? "#7C3AED" : "#6B7280",
    borderBottom: `2px solid ${active ? "#7C3AED" : "transparent"}`,
  });

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9" }}>
      <header style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "0 24px",
        height: "60px", display: "flex", alignItems: "center", gap: "16px" }}>
        <button onClick={() => navigate("/")}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px" }}>←</button>
        <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#1F1735" }}>Admin 패널</h1>
      </header>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 24px" }}>
        {error   && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success" onClose={() => setSuccess(null)}>{success}</Alert>}

        {/* 멤버십 부여 폼 */}
        <section style={{ background: "#fff", border: "1px solid #E5E7EB",
          borderRadius: "16px", padding: "24px", marginBottom: "28px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px", color: "#1F1735" }}>
            멤버십 강제 부여
          </h2>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={labelStyle}>User ID</label>
              <input value={grantUserId} onChange={e => setGrantUserId(e.target.value)}
                placeholder="User UUID" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>플랜</label>
              <select value={grantPlanId} onChange={e => setGrantPlanId(e.target.value)} style={inputStyle}>
                <option value="">선택하세요</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name} ({p.duration_days}일)</option>)}
              </select>
            </div>
            <button onClick={handleGrant} disabled={granting || !grantUserId || !grantPlanId}
              style={{ padding: "10px 20px", background: grantUserId && grantPlanId ? "#7C3AED" : "#E5E7EB",
                color: grantUserId && grantPlanId ? "#fff" : "#9CA3AF",
                border: "none", borderRadius: "10px", fontWeight: 600, cursor: "pointer" }}>
              {granting ? "처리 중..." : "부여하기"}
            </button>
          </div>
        </section>

        {/* 탭 */}
        <div style={{ borderBottom: "1px solid #E5E7EB", marginBottom: "20px" }}>
          <button style={tabStyle(tab === "users")} onClick={() => setTab("users")}>
            사용자 ({users.length})
          </button>
          <button style={tabStyle(tab === "memberships")} onClick={() => setTab("memberships")}>
            멤버십 ({memberships.length})
          </button>
        </div>

        {loading && <div style={{ textAlign: "center", color: "#9CA3AF", padding: "40px" }}>로딩 중...</div>}

        {/* 사용자 테이블 */}
        {!loading && tab === "users" && (
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: "16px", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  {["이름", "이메일", "권한", "활성 멤버십", "계정 전환", "ID 복사"].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={tdStyle}><span style={{ fontWeight: 500 }}>{u.name}</span></td>
                    <td style={{ ...tdStyle, color: "#6B7280" }}>{u.email}</td>
                    <td style={tdStyle}>
                      <span style={{ background: u.admin ? "#EDE9FE" : "#F3F4F6",
                        color: u.admin ? "#7C3AED" : "#6B7280",
                        padding: "2px 8px", borderRadius: "8px", fontSize: "12px", fontWeight: 500 }}>
                        {u.admin ? "Admin" : "User"}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontSize: "13px", color: u.active_membership ? "#059669" : "#9CA3AF" }}>
                      {u.active_membership
                        ? `${u.active_membership.plan_name} (${u.active_membership.days_remaining}일)`
                        : "없음"}
                    </td>
                    <td style={tdStyle}>
                      <button onClick={() => loginAs(u.id, u.name)}
                        style={{ padding: "4px 10px", background: "#EDE9FE", color: "#7C3AED",
                          border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "12px" }}>
                        이 계정으로
                      </button>
                    </td>
                    <td style={tdStyle}>
                      <button onClick={() => { navigator.clipboard.writeText(u.id); setSuccess(`ID 복사됨: ${u.name}`); }}
                        style={{ padding: "4px 10px", background: "#F3F4F6", color: "#374151",
                          border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "12px" }}>
                        복사
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 멤버십 테이블 */}
        {!loading && tab === "memberships" && (
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: "16px", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  {["사용자", "플랜", "상태", "만료일", "부여 방식", "액션"].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {memberships.map(m => (
                  <tr key={m.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>{(m as Membership & { user?: { name: string; email: string } }).user?.name}</div>
                      <div style={{ fontSize: "12px", color: "#9CA3AF" }}>{(m as Membership & { user?: { name: string; email: string } }).user?.email}</div>
                    </td>
                    <td style={tdStyle}>{m.plan?.name}</td>
                    <td style={tdStyle}>
                      <span style={{ background: m.status === "active" ? "#F0FDF4" : "#FEF2F2",
                        color: m.status === "active" ? "#166534" : "#DC2626",
                        padding: "2px 8px", borderRadius: "8px", fontSize: "12px", fontWeight: 500 }}>
                        {m.status}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontSize: "13px", color: "#6B7280" }}>
                      {new Date(m.expires_at).toLocaleDateString("ko-KR")}
                    </td>
                    <td style={{ ...tdStyle, fontSize: "13px", color: "#6B7280" }}>
                      {m.granted_by === "admin" ? "관리자" : "결제"}
                    </td>
                    <td style={tdStyle}>
                      {m.status === "active" && (
                        <button onClick={() => handleRevoke(m.id)}
                          style={{ padding: "4px 10px", background: "#FEF2F2", color: "#DC2626",
                            border: "1px solid #FECACA", borderRadius: "8px", cursor: "pointer", fontSize: "12px" }}>
                          취소
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Alert({ type, children, onClose }: {
  type: "error" | "success"; children: React.ReactNode; onClose?: () => void;
}) {
  const c = type === "error"
    ? { bg: "#FEF2F2", border: "#FECACA", text: "#DC2626" }
    : { bg: "#F0FDF4", border: "#BBF7D0", text: "#166534" };
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: "12px",
      padding: "12px 16px", color: c.text, marginBottom: "16px", fontSize: "14px",
      display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      {children}
      {onClose && <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: c.text, fontSize: "16px" }}>✕</button>}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: "12px", color: "#6B7280", marginBottom: "4px" };
const inputStyle: React.CSSProperties = { padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", minWidth: "200px" };
const thStyle: React.CSSProperties = { padding: "12px 16px", textAlign: "left", fontSize: "13px", color: "#6B7280", fontWeight: 500, borderBottom: "1px solid #E5E7EB" };
const tdStyle: React.CSSProperties = { padding: "14px 16px", fontSize: "14px", color: "#1F1735" };
