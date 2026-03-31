require "rails_helper"

RSpec.describe "Payments", type: :request do
  let(:user) { create(:user) }
  let(:plan) { create(:membership_plan, :premium) }

  let(:pg_success) do
    { success: true, transaction_id: "PG_MOCK_001",
      amount: plan.price_cents, currency: "KRW",
      payment_method: "card", approved_at: Time.current.iso8601, card_info: {} }
  end

  describe "POST /payments" do
    context "with valid payment" do
      before { allow_any_instance_of(PaymentGatewayService).to receive(:charge).and_return(pg_success) }

      it "returns 201 and creates membership" do
        post "/payments",
             params:  { membership_plan_id: plan.id, payment_method: "card" },
             headers: { "X-User-Id" => user.id }

        expect(response).to have_http_status(:created)
        body = JSON.parse(response.body)
        expect(body["payment"]["status"]).to         eq("completed")
        expect(body["membership"]["plan"]["name"]).to eq("프리미엄")
      end
    end

    context "when PG fails" do
      before do
        allow_any_instance_of(PaymentGatewayService).to receive(:charge)
          .and_return({ success: false, error_message: "카드 한도 초과" })
      end

      it "returns 402" do
        post "/payments",
             params:  { membership_plan_id: plan.id },
             headers: { "X-User-Id" => user.id }
        expect(response).to have_http_status(:payment_required)
      end
    end

    it "returns 401 without X-User-Id" do
      post "/payments", params: { membership_plan_id: plan.id }
      expect(response).to have_http_status(:unauthorized)
    end

    it "returns 404 for inactive plan" do
      inactive = create(:membership_plan, :inactive)
      post "/payments",
           params:  { membership_plan_id: inactive.id },
           headers: { "X-User-Id" => user.id }
      expect(response).to have_http_status(:not_found)
    end
  end
end
