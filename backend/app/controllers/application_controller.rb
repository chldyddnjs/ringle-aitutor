class ApplicationController < ActionController::API
  include ActionController::Live

  before_action :set_current_user

  rescue_from ActiveRecord::RecordNotFound,  with: :render_not_found
  rescue_from ActiveRecord::RecordInvalid,   with: :render_unprocessable
  rescue_from MembershipService::Error,      with: :render_payment_error

  private

  # 인증 제외 요구사항 → X-User-Id 헤더로 사용자 식별
  # 실서비스 전환 시 이 메서드만 JWT 검증으로 교체
  def set_current_user
    user_id = request.headers["X-User-Id"]
    @current_user = User.find_by(id: user_id) if user_id.present?
  end

  def current_user
    @current_user
  end

  def require_user!
    render json: { error: "X-User-Id 헤더가 필요합니다." }, status: :unauthorized unless current_user
  end

  def require_admin!
    require_user!
    return if performed?
    render json: { error: "어드민 권한이 필요합니다." }, status: :forbidden unless current_user.admin?
  end

  def require_active_membership!(feature: nil)
    require_user!
    return if performed?

    membership = current_user.active_membership
    unless membership
      render json: { error: "활성 멤버십이 필요합니다.", code: "NO_MEMBERSHIP" }, status: :forbidden
      return
    end

    if feature && !current_user.can_use_feature?(feature)
      render json: {
        error: "'#{feature}' 기능이 포함된 멤버십이 필요합니다.",
        code:  "FEATURE_NOT_INCLUDED"
      }, status: :forbidden
    end
  end

  def render_not_found(e)
    render json: { error: e.message }, status: :not_found
  end

  def render_unprocessable(e)
    render json: { error: e.message, details: e.record&.errors&.full_messages }, status: :unprocessable_entity
  end

  def render_payment_error(e)
    render json: { error: e.message }, status: :payment_required
  end
end
