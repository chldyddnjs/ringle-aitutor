require_relative "boot"
require "rails/all"
Bundler.require(*Rails.groups)

module RingleAiTutor
  class Application < Rails::Application
    config.load_defaults 7.1
    config.api_only = true

    # SSE(ActionController::Live) 스트리밍을 위해 필요
    # api_only 모드에서 기본 제외되는 미들웨어 일부 복원
    config.middleware.use ActionDispatch::Cookies
    config.middleware.use ActionDispatch::Session::CookieStore

    if ENV["RAILS_LOG_TO_STDOUT"].present?
      logger           = ActiveSupport::Logger.new(STDOUT)
      logger.formatter = config.log_formatter
      config.logger    = ActiveSupport::TaggedLogging.new(logger)
    end
  end
end
