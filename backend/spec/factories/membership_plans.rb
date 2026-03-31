FactoryBot.define do
  factory :membership_plan do
    name                 { "베이직" }
    duration_days        { 30 }
    price_cents          { 12_900_000 }
    currency             { "KRW" }
    feature_learning     { true }
    feature_conversation { false }
    feature_analysis     { false }
    active               { true }

    trait :premium do
      name                 { "프리미엄" }
      duration_days        { 60 }
      price_cents          { 21_900_000 }
      feature_conversation { true }
      feature_analysis     { true }
    end
    trait(:inactive) { active { false } }
  end
end
