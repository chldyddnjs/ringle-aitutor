class MembershipService
  class Error < StandardError; end

  # 어드민이 유저에게 멤버십 강제 부여
  def self.admin_grant(user:, plan:, admin:, starts_at: Time.current)
    ActiveRecord::Base.transaction do
      Membership.create!(
        user:                  user,
        membership_plan:       plan,
        starts_at:             starts_at,
        expires_at:            starts_at + plan.duration_days.days,
        status:                "active",
        granted_by:            "admin",
        granted_by_admin_id:   admin.id
      )
    end
  end

  # 유저 결제를 통한 멤버십 획득
  def self.purchase(user:, plan:, payment_method: "card")
    ActiveRecord::Base.transaction do
      # 1. 결제 레코드 생성 (pending)
      payment = Payment.create!(
        user:            user,
        membership_plan: plan,
        amount_cents:    plan.price_cents,
        currency:        plan.currency,
        status:          "pending",
        payment_method:  payment_method
      )

      # 2. PG사 결제 요청 (Mock)
      pg = PaymentGatewayService.new(
        amount_cents:   plan.price_cents,
        currency:       plan.currency,
        payment_method: payment_method
      )
      result = pg.charge

      unless result[:success]
        payment.update!(status: "failed", pg_response: result)
        raise Error, "결제 실패: #{result[:error_message]}"
      end

      # 3. 멤버십 생성
      starts_at  = Time.current
      membership = Membership.create!(
        user:            user,
        membership_plan: plan,
        starts_at:       starts_at,
        expires_at:      starts_at + plan.duration_days.days,
        status:          "active",
        granted_by:      "user"
      )

      # 4. 결제 완료 처리
      payment.update!(
        status:            "completed",
        membership:        membership,
        pg_transaction_id: result[:transaction_id],
        pg_response:       result
      )

      { membership: membership, payment: payment }
    end
  end

  # 멤버십 취소 (어드민 또는 시스템)
  def self.cancel(membership:)
    membership.update!(status: "cancelled")
    membership
  end
end
