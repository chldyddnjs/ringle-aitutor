class CreatePayments < ActiveRecord::Migration[7.1]
  def change
    create_table :payments, id: :uuid do |t|
      t.references :user,            null: false, foreign_key: true, type: :uuid
      t.references :membership_plan, null: false, foreign_key: true, type: :uuid
      t.references :membership,      foreign_key: true, type: :uuid
      t.integer :amount_cents, null: false
      t.string  :currency,     null: false, default: "KRW"
      t.string  :status,       null: false, default: "pending"  # pending | completed | failed
      t.string  :pg_transaction_id
      t.jsonb   :pg_response, default: {}
      t.string  :payment_method
      t.timestamps
    end
    add_index :payments, :pg_transaction_id
  end
end
