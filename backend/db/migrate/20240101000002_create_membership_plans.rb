class CreateMembershipPlans < ActiveRecord::Migration[7.1]
  def change
    create_table :membership_plans, id: :uuid do |t|
      t.string  :name,                  null: false
      t.integer :duration_days,         null: false
      t.integer :price_cents,           null: false, default: 0
      t.string  :currency,              null: false, default: "KRW"
      t.boolean :feature_learning,      null: false, default: false
      t.boolean :feature_conversation,  null: false, default: false
      t.boolean :feature_analysis,      null: false, default: false
      t.boolean :active,                null: false, default: true
      t.timestamps
    end
  end
end
