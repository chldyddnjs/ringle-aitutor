require "rails_helper"

RSpec.describe "AI endpoints", type: :request do
  let(:user)  { create(:user) }
  let(:plan)  { create(:membership_plan, :premium) }
  let!(:membership) { create(:membership, user: user, membership_plan: plan) }

  let(:headers) { { "X-User-Id" => user.id } }

  # ────────────────────────────────────────────────────────────────
  # POST /ai/stt
  # ────────────────────────────────────────────────────────────────
  describe "POST /ai/stt" do
    let(:audio_file) do
      fixture = Tempfile.new(["test_audio", ".webm"])
      fixture.write("x" * 200)   # 200 bytes — 최소 크기(100) 초과
      fixture.rewind
      Rack::Test::UploadedFile.new(fixture.path, "audio/webm")
    end

    context "with a valid audio file and active membership" do
      before do
        allow_any_instance_of(OpenAI::Client).to receive_message_chain(:audio, :transcribe)
          .and_return({ "text" => "Hello world" })
      end

      it "returns 200 with transcribed text" do
        post "/ai/stt", params: { audio: audio_file }, headers: headers
        expect(response).to have_http_status(:ok)
        expect(JSON.parse(response.body)["text"]).to eq("Hello world")
      end
    end

    context "when audio param is missing" do
      it "returns 400" do
        post "/ai/stt", params: {}, headers: headers
        expect(response).to have_http_status(:bad_request)
      end
    end

    context "when audio file is too small (< 100 bytes)" do
      let(:tiny_file) do
        f = Tempfile.new(["tiny", ".webm"])
        f.write("x" * 50)
        f.rewind
        Rack::Test::UploadedFile.new(f.path, "audio/webm")
      end

      it "returns 400" do
        post "/ai/stt", params: { audio: tiny_file }, headers: headers
        expect(response).to have_http_status(:bad_request)
      end
    end

    context "without X-User-Id header" do
      it "returns 401" do
        post "/ai/stt", params: { audio: audio_file }
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "when user has no active membership" do
      let(:user_no_plan) { create(:user) }

      it "returns 403" do
        post "/ai/stt",
             params:  { audio: audio_file },
             headers: { "X-User-Id" => user_no_plan.id }
        expect(response).to have_http_status(:forbidden)
        expect(JSON.parse(response.body)["code"]).to eq("NO_MEMBERSHIP")
      end
    end

    context "when membership lacks conversation feature" do
      let(:basic_plan) { create(:membership_plan) }  # feature_conversation: false
      let(:basic_user) { create(:user) }
      let!(:basic_membership) { create(:membership, user: basic_user, membership_plan: basic_plan) }

      it "returns 403 with FEATURE_NOT_INCLUDED" do
        post "/ai/stt",
             params:  { audio: audio_file },
             headers: { "X-User-Id" => basic_user.id }
        expect(response).to have_http_status(:forbidden)
        expect(JSON.parse(response.body)["code"]).to eq("FEATURE_NOT_INCLUDED")
      end
    end

    context "when OpenAI returns a bad request error" do
      before do
        allow_any_instance_of(OpenAI::Client).to receive_message_chain(:audio, :transcribe)
          .and_raise(Faraday::BadRequestError.new("bad audio"))
      end

      it "returns 400 with a helpful message" do
        post "/ai/stt", params: { audio: audio_file }, headers: headers
        expect(response).to have_http_status(:bad_request)
        expect(JSON.parse(response.body)["error"]).to match(/형식/)
      end
    end
  end

  # ────────────────────────────────────────────────────────────────
  # POST /ai/tts
  # ────────────────────────────────────────────────────────────────
  describe "POST /ai/tts" do
    let(:fake_audio_bytes) { "fake-mp3-bytes" }

    context "with valid text and active membership" do
      before do
        allow_any_instance_of(OpenAI::Client).to receive_message_chain(:audio, :speech)
          .and_return(fake_audio_bytes)
      end

      it "returns 200 with audio/mpeg content type" do
        post "/ai/tts",
             params:  { text: "Hello!" }.to_json,
             headers: headers.merge("Content-Type" => "application/json")
        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include("audio/mpeg")
      end

      it "uses the default voice (alloy) when none specified" do
        expect_any_instance_of(OpenAI::Client).to receive_message_chain(:audio, :speech)
          .with(parameters: hash_including(voice: "alloy"))
          .and_return(fake_audio_bytes)
        post "/ai/tts",
             params:  { text: "Test" }.to_json,
             headers: headers.merge("Content-Type" => "application/json")
      end
    end

    context "when text is blank" do
      it "returns 400" do
        post "/ai/tts",
             params:  { text: "" }.to_json,
             headers: headers.merge("Content-Type" => "application/json")
        expect(response).to have_http_status(:bad_request)
      end
    end

    context "when text exceeds 4096 characters" do
      it "returns 400" do
        post "/ai/tts",
             params:  { text: "a" * 4097 }.to_json,
             headers: headers.merge("Content-Type" => "application/json")
        expect(response).to have_http_status(:bad_request)
      end
    end

    context "without X-User-Id header" do
      it "returns 401" do
        post "/ai/tts",
             params:  { text: "Hello" }.to_json,
             headers: { "Content-Type" => "application/json" }
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  # ────────────────────────────────────────────────────────────────
  # POST /ai/chat  (SSE streaming)
  # ────────────────────────────────────────────────────────────────
  describe "POST /ai/chat" do
    let(:valid_messages) { [{ role: "user", content: "Hello" }] }

    def stub_openai_stream(chunks: ["Hi", " there"], finish: true)
      allow_any_instance_of(OpenAI::Client).to receive(:chat) do |_, parameters:|
        stream_proc = parameters[:stream]
        chunks.each_with_index do |text, i|
          stream_proc.call({ "choices" => [{ "delta" => { "content" => text }, "finish_reason" => nil }] }, nil)
        end
        if finish
          stream_proc.call({ "choices" => [{ "delta" => {}, "finish_reason" => "stop" }] }, nil)
        end
      end
    end

    context "with valid messages and active membership" do
      before { stub_openai_stream }

      it "returns 200 with text/event-stream content type" do
        post "/ai/chat",
             params:  { messages: valid_messages }.to_json,
             headers: headers.merge("Content-Type" => "application/json")
        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include("text/event-stream")
      end

      it "streams data chunks followed by [DONE]" do
        post "/ai/chat",
             params:  { messages: valid_messages }.to_json,
             headers: headers.merge("Content-Type" => "application/json")
        body = response.body
        expect(body).to include("data: ")
        expect(body).to include("[DONE]")
      end
    end

    context "when messages param is missing" do
      it "returns 400" do
        post "/ai/chat",
             params:  {}.to_json,
             headers: headers.merge("Content-Type" => "application/json")
        expect(response).to have_http_status(:bad_request)
      end
    end

    context "when messages is an empty array" do
      it "returns 400" do
        post "/ai/chat",
             params:  { messages: [] }.to_json,
             headers: headers.merge("Content-Type" => "application/json")
        expect(response).to have_http_status(:bad_request)
      end
    end

    context "without X-User-Id header" do
      it "returns 401" do
        post "/ai/chat",
             params:  { messages: valid_messages }.to_json,
             headers: { "Content-Type" => "application/json" }
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "when user has no active membership" do
      let(:user_no_plan) { create(:user) }

      it "returns 403" do
        post "/ai/chat",
             params:  { messages: valid_messages }.to_json,
             headers: { "X-User-Id" => user_no_plan.id, "Content-Type" => "application/json" }
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when rate limit is exceeded" do
      before do
        stub_openai_stream
        # chat 카운터를 한도(30) 초과로 올림
        cache_key = "chat_count:#{user.id}:#{Time.current.beginning_of_hour.to_i}"
        Rails.cache.write(cache_key, 31, expires_in: 1.hour)
      end

      after { Rails.cache.clear }

      it "returns 429" do
        post "/ai/chat",
             params:  { messages: valid_messages }.to_json,
             headers: headers.merge("Content-Type" => "application/json")
        expect(response).to have_http_status(:too_many_requests)
        expect(JSON.parse(response.body)["code"]).to eq("RATE_LIMITED")
      end
    end

    context "when OPENAI_API_KEY is missing" do
      before do
        stub_openai_stream
        allow(ENV).to receive(:fetch).with("OPENAI_API_KEY").and_raise(KeyError, "key not found")
      end

      it "streams an error event" do
        post "/ai/chat",
             params:  { messages: valid_messages }.to_json,
             headers: headers.merge("Content-Type" => "application/json")
        expect(response.body).to include("OPENAI_API_KEY")
      end
    end

    context "build_messages helper" do
      it "truncates history to last 20 messages" do
        messages_30 = 30.times.map { |i| { role: i.even? ? "user" : "assistant", content: "msg #{i}" } }
        stub_openai_stream
        expect_any_instance_of(OpenAI::Client).to receive(:chat) do |_, parameters:|
          history = parameters[:parameters][:messages]
          # system + last 20 = 21 total
          expect(history.length).to eq(21)
          expect(history.first[:role]).to eq("system")
          parameters[:parameters][:stream].call(
            { "choices" => [{ "delta" => {}, "finish_reason" => "stop" }] }, nil
          )
        end
        post "/ai/chat",
             params:  { messages: messages_30 }.to_json,
             headers: headers.merge("Content-Type" => "application/json")
      end
    end
  end
end