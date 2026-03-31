class AiController < ApplicationController
  include ActionController::Live

  before_action :require_user!
  before_action -> { require_active_membership!(feature: "conversation") }

  SYSTEM_PROMPT = <<~PROMPT.freeze
    You are Alex, a friendly and encouraging English tutor at Ringle AI Tutor.
    Your role is to help Korean learners improve their English through natural spoken conversation.

    Guidelines:
    - Always respond in English only.
    - Keep each response concise: 2-3 sentences maximum, suitable for spoken conversation.
    - Naturally and gently point out significant grammar or vocabulary errors inline.
    - Ask one follow-up question per turn to keep the conversation going.
    - Stay on the established topic. If the user goes off-topic, gently redirect.
    - Match vocabulary to approximately B1-B2 level unless context suggests otherwise.
    - Be warm, patient, and encouraging at all times.

    At the very start of a new conversation, greet the user warmly and introduce today's
    conversation topic (e.g., self-introduction, hobbies, travel, career, etc.).
  PROMPT

  SSE_ERROR_API_KEY  = 'data: {"error":"OPENAI_API_KEY 환경변수가 없습니다."}'.freeze
  SSE_ERROR_GENERIC  = 'data: {"error":"AI 서비스 오류가 발생했습니다."}'.freeze
  SSE_DONE           = "data: [DONE]".freeze

  # POST /ai/chat  →  SSE text/event-stream
  def chat
    messages = params[:messages]
    unless messages.is_a?(Array) && messages.present?
      render json: { error: "messages 배열이 필요합니다." }, status: :bad_request
      return
    end

    cache_key = "chat_count:#{current_user.id}:#{Time.current.beginning_of_hour.to_i}"
    count = Rails.cache.increment(cache_key, 1, expires_in: 1.hour)
    if count > 30
      render json: { error: "요청 횟수를 초과했습니다.", code: "RATE_LIMITED" },
             status: :too_many_requests
      return
    end

    response.headers["Content-Type"]      = "text/event-stream"
    response.headers["Cache-Control"]     = "no-cache"
    response.headers["X-Accel-Buffering"] = "no"

    client = OpenAI::Client.new(access_token: ENV.fetch("OPENAI_API_KEY"))

    begin
      client.chat(
        parameters: {
          model:       "gpt-4o",
          messages:    build_messages(messages),
          stream:      proc { |chunk, _|
            delta = chunk.dig("choices", 0, "delta", "content")
            response.stream.write("data: #{delta.to_json}\n\n") if delta

            if chunk.dig("choices", 0, "finish_reason") == "stop"
              response.stream.write("#{SSE_DONE}\n\n")
            end
          },
          max_tokens:  512,
          temperature: 0.7
        }
      )
    rescue ActionController::Live::ClientDisconnected
      # 클라이언트가 연결을 끊음 — 정상적인 상황
    rescue KeyError => e
      Rails.logger.error("[AI Chat] Missing env var: #{e.message}")
      response.stream.write("#{SSE_ERROR_API_KEY}\n\n") rescue nil
    rescue => e
      Rails.logger.error("[AI Chat] #{e.class}: #{e.message}")
      response.stream.write("#{SSE_ERROR_GENERIC}\n\n") rescue nil
    ensure
      response.stream.close
    end
  end

  # POST /ai/tts
  def tts
    text  = params[:text].to_s.strip
    voice = params[:voice].presence || "alloy"

    if text.blank? || text.length > 4096
      render json: { error: "text는 필수이며 4096자 이하여야 합니다." }, status: :bad_request
      return
    end

    client = OpenAI::Client.new(access_token: ENV.fetch("OPENAI_API_KEY"))
    audio  = client.audio.speech(
      parameters: { model: "tts-1", input: text, voice: voice, response_format: "mp3" }
    )

    send_data audio, type: "audio/mpeg", disposition: "inline"
  rescue => e
    Rails.logger.error("[TTS] #{e.class}: #{e.message}")
    render json: { error: "TTS 서비스 오류가 발생했습니다." }, status: :service_unavailable
  end

  # POST /ai/stt  (multipart/form-data, field: "audio")
  def stt
    unless params[:audio]
      render json: { error: "audio 파일이 필요합니다." }, status: :bad_request
      return
    end

    uploaded = params[:audio]

    if uploaded.size > 25.megabytes
      render json: { error: "파일이 너무 큽니다. (최대 25MB)" }, status: :bad_request
      return
    end

    if uploaded.size < 100
      render json: { error: "녹음된 내용이 너무 짧습니다." }, status: :bad_request
      return
    end

    result = transcribe_with_temp_file(uploaded)
    render json: { text: result["text"].to_s.strip }
  rescue Faraday::BadRequestError => e
    Rails.logger.error("[STT] Bad request: #{e.message}")
    render json: { error: "음성 파일 형식이 올바르지 않습니다. 다시 시도해 주세요." }, status: :bad_request
  rescue => e
    Rails.logger.error("[STT] #{e.class}: #{e.message}")
    render json: { error: "STT 서비스 오류가 발생했습니다." }, status: :service_unavailable
  end

  private

  # ActionDispatch::Http::UploadedFile → Tempfile 변환 후 Whisper 호출
  # ruby-openai gem은 File 객체를 기대하며, UploadedFile을 직접 넘기면
  # 파일 포인터가 이미 읽힌 상태일 수 있어 400 에러가 발생할 수 있습니다.
  def transcribe_with_temp_file(uploaded)
    original_name = uploaded.original_filename.presence || "recording.webm"
    ext           = File.extname(original_name).presence || ".webm"

    Tempfile.create(["whisper_upload", ext]) do |tmp|
      tmp.binmode
      uploaded.rewind
      tmp.write(uploaded.read)
      tmp.rewind

      client = OpenAI::Client.new(access_token: ENV.fetch("OPENAI_API_KEY"))
      client.audio.transcribe(
        parameters: {
          model:           "whisper-1",
          file:            tmp,
          language:        "en",
          response_format: "json"
        }
      )
    end
  end

  def build_messages(raw_messages)
    history = raw_messages
      .map { |m|
        {
          role:    m["role"].in?(%w[user assistant]) ? m["role"] : "user",
          content: m["content"].to_s.truncate(2000)
        }
      }
      .last(20)

    [{ role: "system", content: SYSTEM_PROMPT }] + history
  end
end
