class Rack::Attack
  Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new

  # AI chat: 30회/시간/유저
  throttle("ai/chat", limit: 30, period: 1.hour) do |req|
    req.env["HTTP_X_USER_ID"] if req.path == "/ai/chat" && req.post?
  end

  # STT: 60회/시간/유저
  throttle("ai/stt", limit: 60, period: 1.hour) do |req|
    req.env["HTTP_X_USER_ID"] if req.path == "/ai/stt" && req.post?
  end

  # TTS: 60회/시간/유저
  throttle("ai/tts", limit: 60, period: 1.hour) do |req|
    req.env["HTTP_X_USER_ID"] if req.path == "/ai/tts" && req.post?
  end

  # 결제: 10회/시간/유저 (어뷰징 방지)
  throttle("payments", limit: 10, period: 1.hour) do |req|
    req.env["HTTP_X_USER_ID"] if req.path == "/payments" && req.post?
  end

  # IP당 전체 요청: 300회/5분
  throttle("req/ip", limit: 300, period: 5.minutes, &:ip)

  self.throttled_responder = lambda do |_req|
    [429, { "Content-Type" => "application/json" },
     [{ error: "Too many requests. Please slow down.", code: "RATE_LIMITED" }.to_json]]
  end
end
