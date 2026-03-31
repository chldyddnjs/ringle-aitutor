require "active_support/core_ext/integer/time"
Rails.application.configure do
  config.enable_reloading = false
  config.eager_load = true
  config.log_level = :info
  config.log_tags = [:request_id]
end
