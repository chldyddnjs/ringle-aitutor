require "rails_helper"

RSpec.describe "Debug", type: :request do
  let(:user) { create(:user) }
  let(:plan) { create(:membership_plan, :premium) }

  it "shows actual response body for 401 case" do
    post "/payments", params: { membership_plan_id: "x" }
    puts "\n>>> STATUS: #{response.status}"
    puts ">>> BODY: #{response.body}"
    puts ">>> HEADERS: #{response.headers['Content-Type']}"
  end

  it "shows actual response body for valid case" do
    allow_any_instance_of(PaymentGatewayService).to receive(:charge).and_return(
      { success: true, transaction_id: "T1", amount: 100, currency: "KRW",
        payment_method: "card", approved_at: Time.current.iso8601, card_info: {} }
    )
    post "/payments",
         params:  { membership_plan_id: plan.id, payment_method: "card" },
         headers: { "X-User-Id" => user.id }
    puts "\n>>> STATUS: #{response.status}"
    puts ">>> BODY: #{response.body}"
  end
end