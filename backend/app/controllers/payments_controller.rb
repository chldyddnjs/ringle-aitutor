class PaymentsController < ApplicationController
  before_action :require_user!

  # POST /payments
  def create
    plan           = MembershipPlan.active.find(params[:membership_plan_id])
    payment_method = params[:payment_method].presence || "card"

    result = MembershipService.purchase(
      user:           current_user,
      plan:           plan,
      payment_method: payment_method
    )

    render json: {
      message:    "결제가 완료되었습니다.",
      membership: {
        id:             result[:membership].id,
        expires_at:     result[:membership].expires_at,
        days_remaining: result[:membership].days_remaining,
        plan:           { name: plan.name, features: plan.features }
      },
      payment: {
        id:             result[:payment].id,
        amount_cents:   result[:payment].amount_cents,
        status:         result[:payment].status,
        transaction_id: result[:payment].pg_transaction_id
      }
    }, status: :created
  end
end
