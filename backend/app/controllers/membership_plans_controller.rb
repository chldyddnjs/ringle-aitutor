class MembershipPlansController < ApplicationController
  def index
    plans = MembershipPlan.active.order(:price_cents)
    render json: plans.map { |p| serialize_plan(p) }
  end

  private

  def serialize_plan(plan)
    {
      id:            plan.id,
      name:          plan.name,
      price_cents:   plan.price_cents,
      price_display: plan.price_display,
      currency:      plan.currency,
      duration_days: plan.duration_days,
      features: {
        learning:     plan.feature_learning,
        conversation: plan.feature_conversation,
        analysis:     plan.feature_analysis
      }
    }
  end
end
