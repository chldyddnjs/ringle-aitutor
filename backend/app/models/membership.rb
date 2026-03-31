class Membership < ApplicationRecord
  belongs_to :user
  belongs_to :membership_plan

  STATUSES    = %w[active expired cancelled].freeze
  GRANTED_BY  = %w[user admin].freeze

  validates :starts_at,   presence: true
  validates :expires_at,  presence: true
  validates :status,      inclusion: { in: STATUSES }
  validates :granted_by,  inclusion: { in: GRANTED_BY }
  validate  :expires_at_after_starts_at

  scope :active,  -> { where(status: "active").where("expires_at > ?", Time.current) }
  scope :expired, -> { where("expires_at <= ? OR status = ?", Time.current, "expired") }

  before_save :auto_expire

  def active?
    status == "active" && expires_at > Time.current
  end

  def expired?
    expires_at <= Time.current || status == "expired"
  end

  def days_remaining
    return 0 if expired?
    ((expires_at - Time.current) / 1.day).ceil
  end

  # 만료된 레코드를 일괄 처리 (Lazy expiry)
  def self.expire_outdated!
    where(status: "active").where("expires_at <= ?", Time.current)
                           .update_all(status: "expired")
  end

  private

  def expires_at_after_starts_at
    return unless starts_at && expires_at
    errors.add(:expires_at, "must be after starts_at") if expires_at <= starts_at
  end

  def auto_expire
    self.status = "expired" if expires_at <= Time.current && status == "active"
  end
end
