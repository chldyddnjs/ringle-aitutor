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

  config.before(:suite)  { DatabaseCleaner.strategy = :transaction; DatabaseCleaner.clean_with(:truncation) }
  config.around(:each)   { |ex| DatabaseCleaner.cleaning { ex.run } }
end

Shoulda::Matchers.configure do |config|
  config.integrate { |with| with.test_framework :rspec; with.library :rails }
end
