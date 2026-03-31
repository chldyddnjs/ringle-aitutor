class MembershipPlan < ApplicationRecord
  has_many :memberships, dependent: :restrict_with_error
  has_many :payments,    dependent: :restrict_with_error

  validates :name,          presence: true
  validates :duration_days, presence: true, numericality: { greater_than: 0 }
  validates :price_cents,   numericality: { greater_than_or_equal_to: 0 }

  scope :active, -> { where(active: true) }

  def features
    %w[learning conversation analysis].select { |f| public_send(:"feature_#{f}") }
  end

  def price_display
    formatted = price_cents.div(100).to_s.reverse.gsub(/(\d{3})(?=\d)/, '\1,').reverse
    "#{formatted}원"
  end
end
