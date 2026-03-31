FactoryBot.define do
  factory :membership do
    user
    membership_plan
    starts_at  { Time.current }
    expires_at { 30.days.from_now }
    status     { "active" }
    granted_by { "user" }

    trait(:admin_granted) { granted_by { "admin" } }
    trait :expired do
      starts_at  { 61.days.ago }
      expires_at { 1.day.ago }
      status     { "expired" }
    end
    trait :premium do
      association :membership_plan, factory: [:membership_plan, :premium]
      expires_at { 60.days.from_now }
    end
  end
end
