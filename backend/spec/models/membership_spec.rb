require "rails_helper"

RSpec.describe Membership, type: :model do
  describe "associations" do
    it { should belong_to(:user) }
    it { should belong_to(:membership_plan) }
  end

  describe "validations" do
    it { should validate_inclusion_of(:status).in_array(%w[active expired cancelled]) }
    it { should validate_inclusion_of(:granted_by).in_array(%w[user admin]) }

    it "is invalid when expires_at is not after starts_at" do
      m = build(:membership, starts_at: Time.current, expires_at: 1.day.ago)
      expect(m).not_to be_valid
      expect(m.errors[:expires_at]).to be_present
    end
  end

  describe "scopes" do
    let!(:active_m)  { create(:membership) }
    let!(:expired_m) { create(:membership, :expired) }

    it ".active returns only non-expired active memberships" do
      expect(Membership.active).to     include(active_m)
      expect(Membership.active).not_to include(expired_m)
    end

    it ".expired returns expired memberships" do
      expect(Membership.expired).to     include(expired_m)
      expect(Membership.expired).not_to include(active_m)
    end
  end

  describe "#active?" do
    it { expect(build(:membership)).to be_active }
    it { expect(build(:membership, :expired)).not_to be_active }
    it { expect(build(:membership, status: "cancelled")).not_to be_active }
  end

  describe "#days_remaining" do
    it "returns approximate days until expiry" do
      m = build(:membership, expires_at: 10.days.from_now)
      expect(m.days_remaining).to be_between(9, 10)
    end

    it "returns 0 for expired memberships" do
      expect(build(:membership, :expired).days_remaining).to eq(0)
    end
  end

  describe ".expire_outdated!" do
    it "updates status to expired for passed memberships" do
      m = create(:membership, expires_at: 1.hour.ago, status: "active")
      expect { Membership.expire_outdated! }.to change { m.reload.status }.to("expired")
    end

    it "does not affect future memberships" do
      m = create(:membership, expires_at: 1.day.from_now)
      expect { Membership.expire_outdated! }.not_to change { m.reload.status }
    end
  end
end
