FactoryBot.define do
  factory :payment do
    user
    membership_plan
    amount_cents      { 12_900_000 }
    currency          { "KRW" }
    status            { "completed" }
    payment_method    { "card" }
    pg_transaction_id { "PG_MOCK_#{SecureRandom.hex(10).upcase}" }

    trait(:pending) { status { "pending" }; pg_transaction_id { nil } }
    trait(:failed)  { status { "failed" } }
  end
end
