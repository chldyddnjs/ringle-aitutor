class CreateMemberships < ActiveRecord::Migration[7.1]
  def change
    create_table :memberships, id: :uuid do |t|
      t.references :user,            null: false, foreign_key: true, type: :uuid
      t.references :membership_plan, null: false, foreign_key: true, type: :uuid
      t.datetime :starts_at,  null: false
      t.datetime :expires_at, null: false
      t.string :status,      null: false, default: "active"   # active | expired | cancelled
      t.string :granted_by,  null: false, default: "user"     # user | admin
      t.uuid   :granted_by_admin_id
      t.timestamps
    end
    add_index :memberships, [:user_id, :status]
    add_index :memberships, :expires_at
  end
end
