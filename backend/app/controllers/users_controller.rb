class UsersController < ApplicationController
  # GET /users/demo
  # 인증 없이 데모 계정 목록을 반환 (개발/데모 환경 전용)
  # 실서비스에서는 이 엔드포인트를 제거하거나 ENV 플래그로 비활성화
  # app/controllers/users_controller.rb
  def demo
    users = User.includes(memberships: :membership_plan)
                .order(:created_at)
                .map do |u|

      am = u.active_membership 
      
      {
        id:    u.id,
        name:  u.name,
        email: u.email,
        admin: u.admin,
        active_membership: am && am.membership_plan ? {
          plan_name:      am.membership_plan.name,
          features:       am.membership_plan.features,
          days_remaining: am.days_remaining,
        } : nil
      }
    end
    render json: users
  end
end
