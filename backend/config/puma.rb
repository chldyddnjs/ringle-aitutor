# SSE(ActionController::Live)는 요청 당 스레드를 점유합니다.
# 동시 SSE 연결 수만큼 스레드가 필요합니다.
# 개발 환경에서 최소 10개로 설정.
max_threads_count = ENV.fetch("RAILS_MAX_THREADS") { 10 }
min_threads_count = ENV.fetch("RAILS_MIN_THREADS") { 5 }
threads min_threads_count, max_threads_count

worker_timeout 3600 if ENV.fetch("RAILS_ENV", "development") == "development"
port        ENV.fetch("PORT")      { 3000 }
environment ENV.fetch("RAILS_ENV") { "development" }
pidfile     ENV.fetch("PIDFILE")   { "tmp/pids/server.pid" }
plugin :tmp_restart
