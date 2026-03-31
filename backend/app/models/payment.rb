class Payment < ApplicationRecord
  belongs_to :user
  belongs_to :membership_plan
  belongs_to :membership, optional: true

  STATUSES = %w[pending completed failed].freeze

  validates :amount_cents, numericality: { greater_than: 0 }
  validates :status, inclusion: { in: STATUSES }
end
