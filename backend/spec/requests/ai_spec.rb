require "rails_helper"

RSpec.describe "AI endpoints", type: :request do
  # 중요: truncation 전략이 '반드시' 이 파일 전체에 영향을 주어야 합니다.
  before(:all) do
    DatabaseCleaner.strategy = :truncation
  end

  before(:each) do
    # 스트리밍은 별도 스레드라 DB 연결을 공유하지 못하면 403/500이 납니다.
    ActiveRecord::Base.connection_handler.clear_active_connections!
    DatabaseCleaner.start
  end

  after(:each) do
    DatabaseCleaner.clean
  end
  
  let(:user)  { create(:user) }
  
  # 명시적으로 프리미엄 트레이트를 사용하여 대화 기능(feature_conversation)을 활성화
  let(:plan)  { create(:membership_plan, :premium) } 

  # Membership 생성 시 날짜와 상태를 강제로 '유효함'으로 설정
  let!(:membership) do
    create(:membership, 
      user: user, 
      membership_plan: plan,
      status: "active",
      starts_at: 1.day.ago,          # 어제 시작
      expires_at: 30.days.from_now   # 한 달 뒤 만료
    )
  end
  let(:headers) { { "X-User-Id" => user.id.to_s } }


  # 추가: 테스트 실행 전후로 DB를 완전히 물리적으로 쓰고 지우도록 강제
  before(:each) do
    DatabaseCleaner.strategy = :truncation
    DatabaseCleaner.start
  end

  after(:each) do
    DatabaseCleaner.clean
  end

  # ── POST /ai/stt ────────────────────────────────────────────────────────────
  describe "POST /ai/stt" do
    let(:audio_file) do
      fixture = Tempfile.new(["test_audio", ".webm"])
      fixture.write("x" * 200)
      fixture.rewind
      Rack::Test::UploadedFile.new(fixture.path, "audio/webm")
    end

    context "with a valid audio file and active membership" do
      before do
        fake_client = instance_double(OpenAI::Client)
        fake_audio  = instance_double("OpenAI::Audio")
        allow(OpenAI::Client).to receive(:new).and_return(fake_client)
        allow(fake_client).to receive(:audio).and_return(fake_audio)
        allow(fake_audio).to receive(:transcribe).and_return({ "text" => "Hello world" })
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

      it "returns 403 with NO_MEMBERSHIP" do
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
        fake_client = instance_double(OpenAI::Client)
        fake_audio  = instance_double("OpenAI::Audio")
        allow(OpenAI::Client).to receive(:new).and_return(fake_client)
        allow(fake_client).to receive(:audio).and_return(fake_audio)
        allow(fake_audio).to receive(:transcribe).and_raise(Faraday::BadRequestError.new("bad audio"))
      end

      it "returns 400 with a helpful message" do
        post "/ai/stt", params: { audio: audio_file }, headers: headers
        expect(response).to have_http_status(:bad_request)
        expect(JSON.parse(response.body)["error"]).to match(/형식/)
      end
    end
  end

  # ── POST /ai/tts ────────────────────────────────────────────────────────────
  describe "POST /ai/tts" do
    let(:fake_audio_bytes) { "\xFF\xFB\x90\x00".b * 100 }

    context "with valid text and active membership" do
      before do
        fake_client = instance_double(OpenAI::Client)
        fake_audio  = instance_double("OpenAI::Audio")
        allow(OpenAI::Client).to receive(:new).and_return(fake_client)
        allow(fake_client).to receive(:audio).and_return(fake_audio)
        allow(fake_audio).to receive(:speech).and_return(fake_audio_bytes)
      end

      it "returns 200 with audio/mpeg content type" do
        post "/ai/tts",
             params:  { text: "Hello, how are you?" }.to_json,
             headers: headers.merge("Content-Type" => "application/json")
        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include("audio/mpeg")
      end

      it "uses the default voice (alloy) when none specified" do
        fake_client = instance_double(OpenAI::Client)
        fake_audio  = instance_double("OpenAI::Audio")
        allow(OpenAI::Client).to receive(:new).and_return(fake_client)
        allow(fake_client).to receive(:audio).and_return(fake_audio)
        expect(fake_audio).to receive(:speech).with(
          parameters: hash_including(voice: "alloy")
        ).and_return(fake_audio_bytes)

        post "/ai/tts",
             params:  { text: "Hello" }.to_json,
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

  # ── POST /ai/chat ────────────────────────────────────────────────────────────
  describe "POST /ai/chat" do
    let(:valid_messages) { [{ role: "user", content: "Hello" }] }

    let(:fake_stream_chunk) do
      {
        "choices" => [{
          "delta"         => { "content" => "Hi there!" },
          "finish_reason" => nil
        }]
      }
    end

    let(:fake_done_chunk) do
      {
        "choices" => [{
          "delta"         => { "content" => nil },
          "finish_reason" => "stop"
        }]
      }
    end

    before do
      # fake_client = instance_double(OpenAI::Client)
      @fake_client = instance_double(OpenAI::Client)
      allow(OpenAI::Client).to receive(:new).with(any_args).and_return(@fake_client)
      allow(@fake_client).to receive(:chat) do |parameters:|
        if stream_proc = parameters[:stream]
          stream_proc.call(fake_stream_chunk, 0)
          stream_proc.call(fake_done_chunk,   0)
        end
      end
    end

    context "with valid messages and active membership" do
      it "returns 200 with text/event-stream content type" do
        post "/ai/chat",
             params:  { messages: valid_messages }.to_json,
             headers: headers.merge("Content-Type" => "application/json")
        sleep 0.5
        
        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include("text/event-stream")
      end

      it "streams data chunks followed by [DONE]" do
        post "/ai/chat",
             params:  { messages: valid_messages }.to_json,
             headers: headers.merge("Content-Type" => "application/json")
        body = response.body

        sleep 0.5
        
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

    context "when rate limit is exceeded" do
      before do
        allow(Rails.cache).to receive(:increment).and_return(31)
      end

      it "returns 429" do
        post "/ai/chat",
             params:  { messages: valid_messages }.to_json,
             headers: headers.merge("Content-Type" => "application/json")
        expect(response).to have_http_status(:too_many_requests)
      end
    end

    context "when OPENAI_API_KEY is missing" do
      before do
        allow(ENV).to receive(:fetch).with("OPENAI_API_KEY").and_raise(KeyError, "key not found: OPENAI_API_KEY")
      end

      it "streams an error event" do
        post "/ai/chat",
             params:  { messages: valid_messages }.to_json,
             headers: headers.merge("Content-Type" => "application/json")
        
        sleep 0.5
        
        expect(response.body).to include("OPENAI_API_KEY")
      end
    end

    context "build_messages helper" do
      it "truncates history to last 20 messages" do
        # 1. 25개의 가짜 메시지 생성
        messages_25 = 25.times.map { |i| { role: i.even? ? "user" : "assistant", content: "msg #{i}" } }

        # 2. OpenAI::Client.new가 호출될 때 상단 before에서 정의한 @fake_client를 반환하도록 강제
        # with(any_args)를 써야 컨트롤러의 access_token 인자를 무시하고 Mock이 작동합니다.
        allow(OpenAI::Client).to receive(:new).with(any_args).and_return(@fake_client)

        # 3. chat 메서드 호출 시 전달되는 인자를 검증
        expect(@fake_client).to receive(:chat) do |parameters:|
          sent = parameters[:messages]
          # 시스템 프롬프트(1) + 마지막 20개 메시지 = 21개 확인
          expect(sent.length).to eq(21)
          expect(sent.first[:role]).to eq("system")
          
          # 스트리밍 응답 흉내 (이게 없으면 컨트롤러의 response.stream이 안 닫힘)
          stream_proc = parameters[:stream]
          stream_proc.call(fake_done_chunk, 0) if stream_proc
        end

        # 4. 실제 요청 전송
        post "/ai/chat",
            params:  { messages: messages_25 }.to_json,
            headers: headers.merge("Content-Type" => "application/json")
      
        # 5. 별도 스레드에서 돌아가는 스트리밍이 완료될 때까지 대기
        sleep 0.5
      end
    end
  end
end
