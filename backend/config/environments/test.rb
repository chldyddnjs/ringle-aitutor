require "active_support/core_ext/integer/time"
Rails.application.configure do
  config.enable_reloading = false
  config.eager_load = false
  config.cache_store = :null_store
  config.active_support.deprecation = :stderr
  config.active_record.migration_error = :page_load
  config.log_level = :fatal
  config.hosts.clear
end
