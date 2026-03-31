# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.1].define(version: 2024_01_01_000004) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "membership_plans", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "name", null: false
    t.integer "duration_days", null: false
    t.integer "price_cents", default: 0, null: false
    t.string "currency", default: "KRW", null: false
    t.boolean "feature_learning", default: false, null: false
    t.boolean "feature_conversation", default: false, null: false
    t.boolean "feature_analysis", default: false, null: false
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "memberships", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "membership_plan_id", null: false
    t.datetime "starts_at", null: false
    t.datetime "expires_at", null: false
    t.string "status", default: "active", null: false
    t.string "granted_by", default: "user", null: false
    t.uuid "granted_by_admin_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["expires_at"], name: "index_memberships_on_expires_at"
    t.index ["membership_plan_id"], name: "index_memberships_on_membership_plan_id"
    t.index ["user_id", "status"], name: "index_memberships_on_user_id_and_status"
    t.index ["user_id"], name: "index_memberships_on_user_id"
  end

  create_table "payments", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "membership_plan_id", null: false
    t.uuid "membership_id"
    t.integer "amount_cents", null: false
    t.string "currency", default: "KRW", null: false
    t.string "status", default: "pending", null: false
    t.string "pg_transaction_id"
    t.jsonb "pg_response", default: {}
    t.string "payment_method"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["membership_id"], name: "index_payments_on_membership_id"
    t.index ["membership_plan_id"], name: "index_payments_on_membership_plan_id"
    t.index ["pg_transaction_id"], name: "index_payments_on_pg_transaction_id"
    t.index ["user_id"], name: "index_payments_on_user_id"
  end

  create_table "users", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "email", null: false
    t.string "name", null: false
    t.boolean "admin", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "memberships", "membership_plans"
  add_foreign_key "memberships", "users"
  add_foreign_key "payments", "membership_plans"
  add_foreign_key "payments", "memberships"
  add_foreign_key "payments", "users"
end
