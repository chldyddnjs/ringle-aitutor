class MembershipsController < ApplicationController
  before_action :require_user!

  # GET /memberships
  def index
    Membership.expire_outdated!
    memberships = current_user.memberships.includes(:membership_plan).order(created_at: :desc)
    render json: memberships.map { |m| serialize(m) }
  end

  # GET /memberships/active
  def active
    Membership.expire_outdated!
    membership = current_user.active_membership
    if membership
      render json: { active: true, membership: serialize(membership) }
    else
      render json: { active: false, membership: nil }
    end
  end

  private

  def serialize(m)
    {
      id:             m.id,
      status:         m.status,
      active:         m.active?,
      starts_at:      m.starts_at,
      expires_at:     m.expires_at,
      days_remaining: m.days_remaining,
      granted_by:     m.granted_by,
      plan: {
        id:            m.membership_plan.id,
        name:          m.membership_plan.name,
        features:      m.membership_plan.features,
        duration_days: m.membership_plan.duration_days
      }
    }
  end
end
