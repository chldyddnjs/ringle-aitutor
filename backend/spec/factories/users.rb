FactoryBot.define do
  factory :user do
    name  { Faker::Name.name }
    email { Faker::Internet.unique.email }
    admin { false }
    trait(:admin) { admin { true } }
  end
end
