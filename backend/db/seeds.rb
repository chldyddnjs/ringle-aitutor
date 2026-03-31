puts "== Seeding =="

# Plans
basic = MembershipPlan.find_or_create_by!(name: "베이직") do |p|
  p.duration_days        = 30
  p.price_cents          = 12_900_000   # 129,000원
  p.currency             = "KRW"
  p.feature_learning     = true
  p.feature_conversation = false
  p.feature_analysis     = false
end

premium = MembershipPlan.find_or_create_by!(name: "프리미엄 플러스") do |p|
  p.duration_days        = 60
  p.price_cents          = 21_900_000   # 219,000원
  p.currency             = "KRW"
  p.feature_learning     = true
  p.feature_conversation = true
  p.feature_analysis     = true
end

# Users
admin = User.find_or_create_by!(email: "admin@ringle.com") do |u|
  u.name  = "Admin"
  u.admin = true
end

user_premium = User.find_or_create_by!(email: "user_premium@example.com") do |u|
  u.name  = "김민준 (프리미엄)"
  u.admin = false
end

user_basic = User.find_or_create_by!(email: "user_basic@example.com") do |u|
  u.name  = "이서연 (베이직)"
  u.admin = false
end

user_none = User.find_or_create_by!(email: "user_none@example.com") do |u|
  u.name  = "박지호 (멤버십 없음)"
  u.admin = false
end

# Memberships
unless user_premium.active_membership
  Membership.create!(
    user: user_premium, membership_plan: premium,
    starts_at: Time.current, expires_at: 60.days.from_now,
    status: "active", granted_by: "admin", granted_by_admin_id: admin.id
  )
end

unless user_basic.active_membership
  Membership.create!(
    user: user_basic, membership_plan: basic,
    starts_at: Time.current, expires_at: 30.days.from_now,
    status: "active", granted_by: "admin", granted_by_admin_id: admin.id
  )
end

puts "\n✅  Seed 완료!"
puts "=" * 50
puts "Admin        : #{admin.id}"
puts "프리미엄 유저 : #{user_premium.id}"
puts "베이직 유저   : #{user_basic.id}"
puts "멤버십 없음   : #{user_none.id}"
puts "=" * 50
