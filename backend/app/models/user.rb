class User < ApplicationRecord
  has_many :memberships, dependent: :destroy
  has_many :payments,    dependent: :destroy

  validates :email, presence: true,
                    uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :name, presence: true

  before_save { self.email = email.downcase }

  def active_membership
    memberships.active.order(expires_at: :desc).first
  end

  def can_use_feature?(feature)
    active_membership&.membership_plan&.public_send(:"feature_#{feature}") || false
  end
end
