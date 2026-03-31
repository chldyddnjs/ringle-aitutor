require "rails_helper"

RSpec.describe User, type: :model do
  describe "associations" do
    it { should have_many(:memberships).dependent(:destroy) }
    it { should have_many(:payments).dependent(:destroy) }
  end

  describe "validations" do
    subject { build(:user) }
    it { should validate_presence_of(:email) }
    it { should validate_presence_of(:name) }
    it { should validate_uniqueness_of(:email).case_insensitive }
  end

  describe "#active_membership" do
    let(:user) { create(:user) }

    it "returns the active membership" do
      m = create(:membership, user: user)
      expect(user.active_membership).to eq(m)
    end

    it "returns nil when only expired memberships exist" do
      create(:membership, :expired, user: user)
      expect(user.active_membership).to be_nil
    end
  end

  describe "#can_use_feature?" do
    let(:user) { create(:user) }

    it "returns true for a feature included in the active plan" do
      create(:membership, user: user) # basic: learning only
      expect(user.can_use_feature?(:learning)).to     be true
      expect(user.can_use_feature?(:conversation)).to be false
    end

    it "returns false when no active membership" do
      expect(user.can_use_feature?(:learning)).to be false
    end
  end
end
