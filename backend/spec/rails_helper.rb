require "spec_helper"
ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rspec/rails"
require "shoulda/matchers"
require "database_cleaner/active_record"

DatabaseCleaner.allow_remote_database_url = true
Dir[Rails.root.join("spec/support/**/*.rb")].each { |f| require f }

RSpec.configure do |config|
  config.use_transactional_fixtures = false
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!
  config.include FactoryBot::Syntax::Methods

  config.before(:each, type: :request) do
    host! "localhost" # 또는 "www.example.com"
  end

  config.before(:suite) { DatabaseCleaner.clean_with(:truncation) }

  config.before(:each) do |example|
    # ActionController::Live(SSE) 는 별도 스레드에서 DB에 접근하므로
    # :transaction 전략은 해당 스레드에서 사용 불가 → 500 에러 발생
    # /ai/chat 테스트만 :truncation 전략으로 분리
    if example.metadata[:file_path].to_s.include?("ai_spec") &&
       example.description.to_s.downcase.include?("chat")
      DatabaseCleaner.strategy = :truncation
    else
      DatabaseCleaner.strategy = :transaction
    end
  end

  config.around(:each) { |ex| DatabaseCleaner.cleaning { ex.run } }
end

Shoulda::Matchers.configure do |config|
  config.integrate { |with| with.test_framework :rspec; with.library :rails }
end