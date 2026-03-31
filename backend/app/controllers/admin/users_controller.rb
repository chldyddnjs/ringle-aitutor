class Admin::UsersController < ApplicationController
  before_action :require_admin!

  # GET /admin/users
  def index
    users = User.includes(memberships: :membership_plan)
                .order(created_at: :desc)
                .page(params[:page]).per(params[:per_page] || 20)

    render json: {
      users: users.map { |u| serialize(u) },
      meta:  { total: users.total_count, page: users.current_page }
    }
  end

  # GET /admin/users/:id
  def show
    user = User.includes(memberships: :membership_plan).find(params[:id])
    render json: serialize(user, detailed: true)
  end

  private

  def serialize(user, detailed: false)
    am = user.active_membership
    data = {
      id:    user.id,
      name:  user.name,
      email: user.email,
      admin: user.admin,
      active_membership: am && {
        id:             am.id,
        plan_name:      am.membership_plan.name,
        features:       am.membership_plan.features,
        expires_at:     am.expires_at,
        days_remaining: am.days_remaining
      }
    }

    if detailed
      data[:memberships] = user.memberships.includes(:membership_plan).map do |m|
        { id: m.id, status: m.status, plan_name: m.membership_plan.name,
          starts_at: m.starts_at, expires_at: m.expires_at, granted_by: m.granted_by }
      end
    end

    data
  end
end
