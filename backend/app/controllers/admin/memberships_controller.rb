class Admin::MembershipsController < ApplicationController
  before_action :require_admin!

  # GET /admin/memberships
  def index
    Membership.expire_outdated!
    memberships = Membership.includes(:user, :membership_plan)
                            .order(created_at: :desc)
                            .page(params[:page]).per(params[:per_page] || 20)

    render json: {
      memberships: memberships.map { |m| serialize(m) },
      meta: { total: memberships.total_count, page: memberships.current_page }
    }
  end

  # POST /admin/memberships
  def create
    user  = User.find(params[:user_id])
    plan  = MembershipPlan.find(params[:membership_plan_id])
    starts_at = params[:starts_at].present? ? Time.parse(params[:starts_at]) : Time.current

    membership = MembershipService.admin_grant(user: user, plan: plan, admin: current_user, starts_at: starts_at)
    render json: serialize(membership), status: :created
  end

  # DELETE /admin/memberships/:id
  def destroy
    membership = Membership.find(params[:id])
    MembershipService.cancel(membership: membership)
    render json: { message: "멤버십이 취소되었습니다.", id: membership.id }
  end

  private

  def serialize(m)
    {
      id:                  m.id,
      status:              m.status,
      active:              m.active?,
      starts_at:           m.starts_at,
      expires_at:          m.expires_at,
      days_remaining:      m.days_remaining,
      granted_by:          m.granted_by,
      granted_by_admin_id: m.granted_by_admin_id,
      user: { id: m.user.id, name: m.user.name, email: m.user.email },
      plan: { id: m.membership_plan.id, name: m.membership_plan.name, features: m.membership_plan.features }
    }
  end
end
