require "rails_helper"

RSpec.describe "Admin::Memberships", type: :request do
  let(:admin)  { create(:user, :admin) }
  let(:user)   { create(:user) }
  let(:plan)   { create(:membership_plan, :premium) }

  def admin_headers = { "X-User-Id" => admin.id }
  def user_headers  = { "X-User-Id" => user.id }

  describe "POST /admin/memberships" do
    it "grants membership and returns 201" do
      post "/admin/memberships",
           params:  { user_id: user.id, membership_plan_id: plan.id },
           headers: admin_headers

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body["status"]).to      eq("active")
      expect(body["granted_by"]).to  eq("admin")
      expect(body["user"]["id"]).to  eq(user.id)
    end

    it "returns 403 for non-admin" do
      post "/admin/memberships",
           params:  { user_id: user.id, membership_plan_id: plan.id },
           headers: user_headers
      expect(response).to have_http_status(:forbidden)
    end

    it "returns 401 with no user header" do
      post "/admin/memberships", params: { user_id: user.id, membership_plan_id: plan.id }
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "DELETE /admin/memberships/:id" do
    let!(:membership) { create(:membership, user: user, membership_plan: plan) }

    it "cancels the membership" do
      delete "/admin/memberships/#{membership.id}", headers: admin_headers

      expect(response).to have_http_status(:ok)
      expect(membership.reload.status).to eq("cancelled")
    end

    it "returns 403 for non-admin" do
      delete "/admin/memberships/#{membership.id}", headers: user_headers
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "GET /admin/memberships" do
    before { create_list(:membership, 3, membership_plan: plan) }

    it "returns paginated memberships with meta" do
      get "/admin/memberships", headers: admin_headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["memberships"].length).to eq(3)
      expect(body["meta"]["total"]).to      eq(3)
    end
  end
end
