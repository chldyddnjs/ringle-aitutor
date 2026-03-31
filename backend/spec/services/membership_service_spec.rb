require "rails_helper"

RSpec.describe MembershipService, type: :service do
  let(:admin)  { create(:user, :admin) }
  let(:user)   { create(:user) }
  let(:plan)   { create(:membership_plan, :premium) }

  describe ".admin_grant" do
    it "creates an active membership granted by admin" do
      membership = described_class.admin_grant(user: user, plan: plan, admin: admin)

      expect(membership).to be_persisted
      expect(membership.status).to            eq("active")
      expect(membership.granted_by).to        eq("admin")
      expect(membership.granted_by_admin_id).to eq(admin.id)
      expect(membership.expires_at).to be_within(1.minute).of(plan.duration_days.days.from_now)
    end
  end

  describe ".purchase" do
    let(:success_response) do
      { success: true, transaction_id: "PG_MOCK_TEST_001",
        amount: plan.price_cents, currency: "KRW",
        payment_method: "card", approved_at: Time.current.iso8601, card_info: {} }
    end

    context "when PG succeeds" do
      before { allow_any_instance_of(PaymentGatewayService).to receive(:charge).and_return(success_response) }

      it "creates a completed payment and active membership" do
        result = described_class.purchase(user: user, plan: plan)

        expect(result[:membership]).to be_active
        expect(result[:membership].granted_by).to eq("user")
        expect(result[:payment].status).to         eq("completed")
        expect(result[:payment].pg_transaction_id).to eq("PG_MOCK_TEST_001")
      end

      it "links the payment to the membership" do
        result = described_class.purchase(user: user, plan: plan)
        expect(result[:payment].membership).to eq(result[:membership])
      end
    end

    context "when PG fails" do
      before do
        allow_any_instance_of(PaymentGatewayService).to receive(:charge).and_return(
          { success: false, error_message: "카드 한도 초과" }
        )
      end

      it "raises MembershipService::Error" do
        expect { described_class.purchase(user: user, plan: plan) }
          .to raise_error(MembershipService::Error, /카드 한도 초과/)
      end

      it "records the payment as failed and does not create a membership" do
        described_class.purchase(user: user, plan: plan) rescue nil
        expect(Payment.last.status).to eq("failed")
        expect(Membership.count).to    eq(0)
      end
    end
  end

  describe ".cancel" do
    it "sets membership status to cancelled" do
      membership = create(:membership, user: user, membership_plan: plan)
      described_class.cancel(membership: membership)
      expect(membership.reload.status).to eq("cancelled")
    end
  end
end
