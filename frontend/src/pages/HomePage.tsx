import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchActiveMembership, fetchPlans, purchasePlan,
  getUserId, setUserId, clearUserId,
  fetchDemoUsers,
} from "../api/client";
import type { Membership, MembershipPlan, DemoUser } from "../api/client";

const FEATURE_LABEL: Record<string, string> = {
  learning:     "AI 표현 학습",
  conversation: "AI 롤플레잉",
  analysis:     "무제한 AI 분석",
};

const PLAN_COLOR: Record<string, { bg: string; text: string }> = {
  "프리미엄 플러스": { bg: "#EDE9FE", text: "#5B21B6" },
  "베이직":          { bg: "#DBEAFE", text: "#1E40AF" },
};

// ────────────────────────────────────────────────────────────────────────────
// 계정 선택 화면
// ────────────────────────────────────────────────────────────────────────────
function AccountSelector({ onSelect }: { onSelect: (id: string) => void }) {
  const [users,   setUsers]   = useState<DemoUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetchDemoUsers()
      .then(setUsers)
      .catch(() => setError("서버에 연결할 수 없습니다. Docker가 실행 중인지 확인하세요."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(150deg, #F5F3FF 0%, #EDE9FE 60%, #DDD6FE 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{ width: "100%", maxWidth: "460px" }}>

        {/* 로고 */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div style={{ fontSize: "56px", marginBottom: "12px", lineHeight: 1 }}>🤖</div>
          <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#1F1735", marginBottom: "6px" }}>
            Ringle AI Tutor
          </h1>
          <p style={{ color: "#7C3AED", fontSize: "14px", fontWeight: 500 }}>
            AI와 함께하는 영어 학습
          </p>
        </div>

        {/* 카드 */}
        <div style={{
          background: "#fff", borderRadius: "24px", padding: "28px 28px 32px",
          boxShadow: "0 20px 60px rgba(124,58,237,0.13)",
        }}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#1F1735", marginBottom: "4px" }}>
            체험할 계정을 선택하세요
          </h2>
          <p style={{ fontSize: "12px", color: "#9CA3AF", marginBottom: "20px" }}>
            멤버십에 따라 이용 가능한 기능이 다릅니다
          </p>

          {loading && (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#A78BFA" }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>⏳</div>
              서버 연결 중...
            </div>
          )}

          {error && (
            <div style={{
              background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "12px",
              padding: "16px", color: "#DC2626", fontSize: "13px", textAlign: "center",
            }}>
              <div style={{ fontSize: "22px", marginBottom: "6px" }}>⚠️</div>
              {error}
            </div>
          )}

          {!loading && !error && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {users.map(user => {
                const mem   = user.active_membership;
                const color = mem ? (PLAN_COLOR[mem.plan_name] ?? { bg: "#F0FDF4", text: "#166534" }) : null;

                return (
                  <button
                    key={user.id}
                    onClick={() => onSelect(user.id)}
                    style={{
                      width: "100%", padding: "14px 16px",
                      border: "1.5px solid #E5E7EB", borderRadius: "14px",
                      background: "#FAFAF9", cursor: "pointer", textAlign: "left",
                      display: "flex", alignItems: "center", gap: "12px",
                      transition: "all 0.12s ease",
                    }}
                    onMouseEnter={e => {
                      const b = e.currentTarget;
                      b.style.borderColor = "#7C3AED";
                      b.style.background  = "#F5F3FF";
                      b.style.transform   = "translateY(-1px)";
                    }}
                    onMouseLeave={e => {
                      const b = e.currentTarget;
                      b.style.borderColor = "#E5E7EB";
                      b.style.background  = "#FAFAF9";
                      b.style.transform   = "translateY(0)";
                    }}
                  >
                    {/* 아바타 */}
                    <div style={{
                      width: "40px", height: "40px", borderRadius: "50%",
                      background: user.admin ? "#FEF3C7" : "#EDE9FE",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "18px", flexShrink: 0,
                    }}>
                      {user.admin ? "👑" : "👤"}
                    </div>

                    {/* 이름 + 이메일 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                        <span style={{ fontWeight: 700, fontSize: "14px", color: "#1F1735" }}>
                          {user.name}
                        </span>
                        {user.admin && (
                          <span style={{
                            background: "#FEF3C7", color: "#92400E",
                            padding: "1px 6px", borderRadius: "6px",
                            fontSize: "10px", fontWeight: 700,
                          }}>Admin</span>
                        )}
                      </div>
                      <div style={{ fontSize: "11px", color: "#9CA3AF", overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {user.email}
                      </div>
                    </div>

                    {/* 멤버십 뱃지 */}
                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      {mem && color ? (
                        <>
                          <div style={{
                            background: color.bg, color: color.text,
                            padding: "2px 9px", borderRadius: "20px",
                            fontSize: "11px", fontWeight: 600, marginBottom: "2px",
                          }}>
                            {mem.plan_name}
                          </div>
                          <div style={{ fontSize: "10px", color: "#9CA3AF" }}>
                            {mem.days_remaining}일 남음
                          </div>
                          {/* 이용 가능 기능 */}
                          <div style={{ display: "flex", gap: "3px", justifyContent: "flex-end", marginTop: "3px" }}>
                            {mem.features.map(f => (
                              <span key={f} style={{
                                fontSize: "9px", background: "#F5F3FF", color: "#7C3AED",
                                padding: "1px 5px", borderRadius: "4px",
                              }}>
                                {f === "learning" ? "학습" : f === "conversation" ? "대화" : "분석"}
                              </span>
                            ))}
                          </div>
                        </>
                      ) : (
                        <span style={{
                          background: "#F3F4F6", color: "#9CA3AF",
                          padding: "2px 9px", borderRadius: "20px", fontSize: "11px",
                        }}>
                          멤버십 없음
                        </span>
                      )}
                    </div>

                    <span style={{ color: "#C4B5FD", fontSize: "20px", flexShrink: 0 }}>›</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: "11px", color: "#A78BFA", marginTop: "16px" }}>
          데모 환경 · 실서비스에서는 로그인으로 대체됩니다
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 메인 홈 화면
// ────────────────────────────────────────────────────────────────────────────
export function HomePage() {
  const navigate = useNavigate();
  const [userId,     setUserIdState] = useState(getUserId());
  const [membership, setMembership]  = useState<Membership | null>(null);
  const [plans,      setPlans]       = useState<MembershipPlan[]>([]);
  const [loading,    setLoading]     = useState(false);
  const [purchasing, setPurchasing]  = useState<string | null>(null);
  const [error,      setError]       = useState<string | null>(null);
  const [success,    setSuccess]     = useState<string | null>(null);

  useEffect(() => { if (userId) loadData(); }, [userId]);

  async function loadData() {
    setLoading(true); 
    setError(null);
    try {
      const [memRes, plansRes] = await Promise.all([fetchActiveMembership(), fetchPlans()]);
      const uniquePlans = plansRes.filter((plan, index, self) =>
        index === self.findIndex((p) => p.name === plan.name)
      );
      
      setMembership(memRes.membership);
      setPlans(uniquePlans);
    } catch {
      setError("데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }


  async function handlePurchase(planId: string) {
    setPurchasing(planId); setError(null); setSuccess(null);
    try {
      const res = await purchasePlan(planId);
      setSuccess(`구매 완료! ${(res.membership as Membership).plan.name} 멤버십이 활성화되었습니다.`);
      await loadData();
    } catch (e: unknown) {
      setError((e as { error?: string })?.error ?? "결제에 실패했습니다.");
    } finally {
      setPurchasing(null);
    }
  }

  function handleSelectUser(id: string) {
    setUserId(id);
    setUserIdState(id);
  }

  function handleSwitchAccount() {
    clearUserId();
    setUserIdState("");
    setMembership(null);
    setPlans([]);
  }

  const hasConversation = membership?.plan.features.includes("conversation");

  // 계정 미선택 → 온보딩
  if (!userId) {
    return <AccountSelector onSelect={handleSelectUser} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF9" }}>
      {/* 헤더 */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #E5E7EB",
        padding: "0 24px", height: "60px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "22px" }}>🤖</span>
          <span style={{ fontWeight: 700, fontSize: "18px", color: "#1F1735" }}>Ringle AI Tutor</span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={handleSwitchAccount} style={outlineBtn}>계정 변경</button>
          <button onClick={() => navigate("/admin")} style={outlineBtn}>Admin</button>
        </div>
      </header>

      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "40px 24px" }}>
        {error   && <Alert type="error"   onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert type="success" onClose={() => setSuccess(null)}>{success}</Alert>}

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px", color: "#9CA3AF" }}>불러오는 중...</div>
        ) : (
          <>
            {/* 현재 멤버십 */}
            <section style={{
              background: "#fff", border: "1px solid #E5E7EB",
              borderRadius: "20px", padding: "28px 32px", marginBottom: "40px",
            }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px", color: "#1F1735" }}>내 멤버십</h2>
              {membership ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
                    <span style={{ background: "#EDE9FE", color: "#7C3AED", padding: "4px 14px", borderRadius: "20px", fontWeight: 700, fontSize: "14px" }}>
                      {membership.plan.name}
                    </span>
                    <span style={{ color: "#6B7280", fontSize: "14px" }}>
                      {membership.days_remaining}일 남음 · {new Date(membership.expires_at).toLocaleDateString("ko-KR")} 만료
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
                    {membership.plan.features.map(f => (
                      <span key={f} style={{ background: "#F5F3FF", color: "#5B21B6", padding: "4px 10px", borderRadius: "8px", fontSize: "13px" }}>
                        ✓ {FEATURE_LABEL[f] ?? f}
                      </span>
                    ))}
                  </div>
                  {hasConversation ? (
                    <button onClick={() => navigate("/chat")} style={primaryBtn}>AI와 대화 시작하기 →</button>
                  ) : (
                    <p style={{ fontSize: "13px", color: "#9CA3AF" }}>
                      💡 대화 기능이 포함된 플랜으로 업그레이드하면 AI와 직접 대화할 수 있습니다.
                    </p>
                  )}
                </>
              ) : (
                <p style={{ color: "#9CA3AF" }}>활성 멤버십이 없습니다. 아래에서 구매하세요.</p>
              )}
            </section>

            {/* 플랜 목록 */}
            <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "20px", color: "#1F1735" }}>멤버십 플랜</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
                {plans.map(plan => {
                  const isPremium = plan.features.conversation;
                  return (
                    <div key={plan.id} style={{
                      background: "#fff", border: `1.5px solid ${isPremium ? "#C4B5FD" : "#E5E7EB"}`,
                      borderRadius: "20px", padding: "28px", position: "relative",
                      boxShadow: isPremium ? "0 4px 24px rgba(124,58,237,0.10)" : "none",
                    }}>
                      {isPremium && (
                        <div style={{ position: "absolute", top: "-13px", left: "50%", transform: "translateX(-50%)", background: "#7C3AED", color: "#fff", padding: "3px 16px", borderRadius: "20px", fontSize: "12px", fontWeight: 700 }}>인기</div>
                      )}
                      <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "4px", color: "#1F1735" }}>{plan.name}</div>
                      <div style={{ fontSize: "28px", fontWeight: 800, color: "#7C3AED", marginBottom: "2px" }}>{plan.price_display}</div>
                      <div style={{ fontSize: "13px", color: "#9CA3AF", marginBottom: "20px" }}>{plan.duration_days}일 이용권</div>
                      <div style={{ marginBottom: "24px" }}>
                        {(["learning", "conversation", "analysis"] as const).map(f => {
                          const has = plan.features[f];
                          return (
                            <div key={f} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", color: has ? "#374151" : "#D1D5DB", fontSize: "14px" }}>
                              <span style={{ width: "16px", textAlign: "center", fontWeight: 700 }}>{has ? "✓" : "✗"}</span>
                              {FEATURE_LABEL[f]}
                            </div>
                          );
                        })}
                      </div>
                    <button
                      onClick={() => handlePurchase(plan.id)}
                      disabled={!!purchasing}
                      style={{
                        width: "100%", padding: "12px",
                        background: isPremium ? "#7C3AED" : "#F5F3FF",
                        color: isPremium ? "#fff" : "#7C3AED",
                        border: isPremium ? "none" : "1.5px solid #7C3AED",
                        borderRadius: "12px", fontWeight: 600, fontSize: "15px",
                        cursor: purchasing ? "wait" : "pointer", opacity: purchasing ? 0.7 : 1,
                      }}
                    >
                      {purchasing === plan.id ? "처리 중..." : "구매하기"}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Alert({ type, children, onClose }: { type: "error" | "success"; children: React.ReactNode; onClose?: () => void }) {
  const c = type === "error"
    ? { bg: "#FEF2F2", border: "#FECACA", text: "#DC2626" }
    : { bg: "#F0FDF4", border: "#BBF7D0", text: "#166534" };
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: "12px", padding: "12px 16px", color: c.text, marginBottom: "16px", fontSize: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span>{children}</span>
      {onClose && <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: c.text, fontSize: "18px", padding: "0 4px" }}>✕</button>}
    </div>
  );
}

const primaryBtn: React.CSSProperties = { padding: "12px 28px", background: "#7C3AED", color: "#fff", border: "none", borderRadius: "12px", fontWeight: 600, fontSize: "15px", cursor: "pointer" };
const outlineBtn: React.CSSProperties = { padding: "6px 14px", background: "#fff", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: "8px", cursor: "pointer", fontSize: "13px" };
