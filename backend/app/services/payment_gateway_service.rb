# Mock PG (Payment Gateway) Service
# 실서비스 전환 시 이 클래스의 charge 메서드만 교체하면 됩니다.
# 예: Toss Payments, Stripe, KG이니시스 등
class PaymentGatewayService
  class PaymentFailed < StandardError; end

  def initialize(amount_cents:, currency: "KRW", payment_method: "card")
    @amount_cents   = amount_cents
    @currency       = currency
    @payment_method = payment_method
  end

  # PG사 API 호출 (현재는 Mock)
  # 실제 연동 시 이 메서드 내부를 PG SDK 호출로 교체
  def charge
    # simulate_network_delay  # 개발 중 주석 해제 시 지연 테스트 가능

    {
      success:        true,
      transaction_id: "PG_MOCK_#{SecureRandom.hex(10).upcase}",
      amount:         @amount_cents,
      currency:       @currency,
      payment_method: @payment_method,
      approved_at:    Time.current.iso8601,
      card_info:      { brand: "Visa", last4: "4242", exp_month: 12, exp_year: 2027 }
    }
  end

  private

  def simulate_network_delay
    sleep(rand(0.1..0.3))
  end
end
